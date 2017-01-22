"use strict";

const _ = require('lodash');
const when = require('when');
const keys = require('when/keys');
const sequence = require('when/sequence');
const RestError = require('./error');

/**
 * Rest Service for handling Model Persistance logic. Can have
 * multiple implementations for each Model type.
 *
 * @class RestService
 * @extends RestSequelize.Object
 * @namespace RestSequelize
 */
class RestService {

	constructor(sequelize) {
		if(_.isUndefined(sequelize)) {
			throw new Error('You must pass a Sequelize instance when creating RestService instance.');
		}

		this.sequelize = sequelize;
	}

	/**
	 * Find a list of Models, including all declared
	 * associations, for a specific query and count them.
	 *
	 * @method find
	 * @param  {Model}  type
	 * @param  {Object} query
	 * @return {Promise}
	 */
	find(model, query) {
		query = this.populate(model, query);

		return keys.all({
			rows: model.findAll(query),
			count: model.count(_.omit(query, ['include']))
		});
	}

	/**
	 * Find one Model, including all declared
	 * associations, for a specific query.
	 *
	 * @method findOne
	 * @param  {Model}  type
	 * @param  {Object} query
	 * @return {Promise}
	 */
	findOne(model, query) {
		query = this.populate(model, query);

		return model.findOne(query).then(function(instance) {
			if (!instance) {
				return when.reject(new RestError(`Can not find model '${model.name}'.`, 404));
			}

			return instance;
		});
	}

	/**
	 * Persist the Model with all his Associations to the Database.
	 *
	 * @method persist
	 * @param  {Model}  model
	 * @param  {Object} data
	 * @return {Promise}
	 */
	persist(model, data) {
		if(_.isEmpty(data)) {
			throw new RestError('An empty payload recieved from the request.', 400);
		}

		const tasks = [];

		const options = {
			isNewRecord: !data.id
		};

		// Ignore it for now
		// this.populate(model, options);

		const instance = model.build(data, options);

		// Add the task, which will persist the model
		tasks.push((transaction) => {
			return instance.save({ transaction });
		});

		// Resolve association data
		_.each(model.associations, (association) => {
			const type = association.associationType;
			const handler = 'persist' + type;

			if (typeof this[handler] === 'function') {
				const task = this[handler].call(this, association, instance, data);

				if (typeof task === 'function') {
					if (type === 'BelongsTo') {
						tasks.unshift(task);
					} else {
						tasks.push(task);
					}
				}
			}
		});

		return executeTasks(this, tasks, instance);
	}

	/**
	 * Delete the model for the given id.
	 *
	 * @method delete
	 * @param  {String}  type
	 * @param  {Number}  id
	 * @return {Promise}
	 */
	delete(model, id) {
		return this.findOne(model, {
			where: {id}
		}).then((instance) => {
			return instance.destroy();
		});
	}

	/**
	 * Delete all models for the given query.
	 *
	 * This request is executed with a transaction, as it is considered
	 * as a delicate one.
	 *
	 * @method deleteAll
	 * @param  {String}  type
	 * @param  {Object}  query
	 * @return {Promise}
	 */
	deleteAll(model, query) {
		query = query || {};

		return this.transaction((transaction) => {
			query.transaction = transaction;
			return model.destroy(query);
		});
	}

	/**
	 * Find a list of records for this association
	 *
	 * @method findSubResources
	 * @param  {Model}  model
	 * @param  {Number} id
	 * @param  {Model}  subResource
	 * @param  {Object} query
	 * @return {Promise}
	 */
	findSubResources(model, id, subResource, query) {
		return resolveSubresourceInstance(model, id, subResource).spread((instance, association) => {
			const accessor = resolveAccessorMethod(instance, association, 'get');
			return accessor.call(instance, query);
		});
	}

	createSubResources(model, id, subResource, data) {
		return this.transaction((transaction) => {
			return resolveSubresourceInstance(model, id, subResource).spread((instance, association) => {
				const toUpdate = [];
				const toCreate = [];

				const createAccessor = resolveAccessorMethod(instance, association, 'create');
				const updateAccessor = resolveAccessorMethod(instance, association, 'addMultiple');
				const options = {
					transaction: transaction
				};

				function resolveEntry(entry) {
					if (entry.id !== undefined) {
						toUpdate.push(entry);
					} else {
						toCreate.push(createAccessor.call(instance, entry, options));
					}
				}

				if (_.isArray(data)) {
					_.each(data, resolveEntry);
				} else if (_.isObject(data)) {
					resolveEntry(data);
				} else {
					throw new RestError('Invalid data sent to the server.', 400);
				}

				return keys.all({
					updated: updateAccessor.call(instance, toUpdate, options),
					created: when.all(toCreate)
				});
			});
		}).then(function(data) {
			// merge data from mapped promise
			return _.union(data.updated, data.created);
		});
	}

	deleteSubResources(model, id, subResource, query) {
		return resolveSubresourceInstance(model, id, subResource).spread((instance, association) => {
			query.where[association.identifierField] = id;
			return this.deleteAll(subResource, query);
		});
	}

	/**
	 * Persists the `BelongsTo` Association type. If the request contains the data
	 * with the association name, it will be either created or updated, depending
	 * if the data contained the primary key.
	 *
	 * This method returns a Function which will be executed before the model is
	 * persisted in the Database. Function accepts a current Database Transacation
	 * argument.
	 *
	 * @method persistBelongsTo
	 * @param  {Association} association
	 * @param  {Model}       model
	 * @param  {Object}      data
	 * @return {Function}
	 */
	persistBelongsTo(association, model, data) {
		const hash = data[association.as];

		// return if the data is empty
		if (_.isEmpty(hash)) {
			return;
		}

		return _.bind(function(transaction) {			
			const instance = association.target.build(hash, {
				isNewRecord: !hash.id
			});

			let accessor;

			if(instance.isNewRecord) {
				return when.resolve(model);
			} else {
				accessor = association.accessors.set;
			}

			return model[accessor].call(model, instance, {
				transaction: transaction,
				validate: false
			});
		}, this);
	}

	persistBelongsToMany(association, model, data) {
		return this.persistHasMany(association, model, data);
	}

	/**
	 * Persits the `HasMany` Association type. If the request contains the list
	 * of records which matches the Association name, they will be created or updated,
	 * depending if the data contained the primary key.
	 *
	 * This method returns a Function which will be executed after the model is
	 * persisted in the Database. Function accepts a current Database Transacation
	 * argument.
	 *
	 * @method persistHasMany
	 * @param  {Association} association
	 * @param  {Model}       model
	 * @param  {Object}      data
	 * @return {Function}
	 */
	persistHasMany(association, model, data) {
		const records = data[association.as];

		// return if the data is empty
		if (_.isEmpty(records)) {
			return when.resolve();
		}

		if (_.isArray(records)) {
			// Build Model instances out of the hash and sort them
			const models = _.reduce(records, (models, hash) => {
				if (!_.isPlainObject(hash)) {
					hash = {id: hash};
				}
				const isNewRecord = !hash.id;

				if(!isNewRecord) {
					const instance = association.target.build(hash, { isNewRecord });
					models.push(instance);
				}

				return models;
			}, []);

			return (transaction) => {
				return model[association.accessors.set].call(model, models, {
					transaction
				});
			};
		}
	}

	/**
	 * Create a new Transaction. The rollback method is wrapped inside
	 * an internal function for easier managment of unexpected Errors that
	 * may occur during that process.
	 *
	 * This method returns a Promise which is resolved when the transaction is
	 * commited successfully.
	 *
	 * When transaction is rollbacked, it returns a unresolved promise. If the
	 * transaction could not be rollbacked, a DatabaseError is returned as a reason.
	 *
	 * @method transaction
	 * @param  {Function} callback
	 * @return {Promise}
	 */
	transaction() {
		return this.sequelize.transaction.apply(this.sequelize, arguments);
	}

	/**
	 * Include the related records for the given model in the Query.
	 *
	 * @method populate
	 * @param  {Model} model
	 * @param  {Query} query
	 * @return {Query}
	 */
	populate(model, query) {
		query = query || {};

		if (!model.associations) {
			return query;
		}

		if (!_.isArray(query.include)) {
			query.include = [];
		}

		_.each(model.associations, function(association) {
			query.include.push({
				model: association.target,
				as: association.as
			});
		}, this);

		return _.assign({}, query);
	}
}

function resolveSubresourceInstance(model, id, subResource) {
	const association = _.find(model.associations, (association) => {
		if (association.target.name === subResource.name) {
			return association;
		}
	});

	if (!association || _.isEmpty(association)) {
		return when.reject(new RestError(`No subresource with name '${subResource}' found`, 400));
	}

	return model.findById(id).then((instance) => {
		if (!instance) {
			return when.reject(new RestError(`Can not find model '${model.name}'.`, 404));
		}

		return [instance, association];
	});
}

function resolveAccessorMethod(instance, association, accessorKey) {
	var accessor = association.accessors[accessorKey];

	if (typeof instance[accessor] !== 'function') {
		throw new TypeError(`Model has no accessor method '${accessor}.`);
	}

	return instance[accessor];
}

function executeTasks(service, tasks, model) {
	// Execute all tasks with a transaction
	return service.transaction(function(transaction) {
		return sequence(tasks, transaction);
	}).then(function() {
		return model;
	});
}

module.exports = RestService;
