"use strict";

const _ = require('lodash');
const when = require('when');
const keys = require('when/keys');
const sequence = require('when/sequence');
const parallel = require('when/parallel');
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
			count: model.count({
				where: query.where
			})
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
		const instance = model.build(data, {
			isNewRecord: !data.id
		});

		// Add the task, which will persist the model
		tasks.push((transaction) => {
			return instance.save({
				validate: !!data.id,
				transaction: transaction
			});
		});

		// Resolve association data
		_.each(model.associations, function(association) {
			const type = association.associationType;
			const handler = 'persist' + type;

			console.log(handler);

			if (typeof this[handler] === 'function') {
				var task = this[handler].call(this, association, instance, data);

				if (typeof task === 'function') {
					if (type === 'BelongsTo') {
						tasks.unshift(task);
					} else {
						tasks.push(task);
					}
				}
			}
		}, this);

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

		return this.transaction((transaction, commit, rollback) => {
			query.transaction = transaction;

			return model.destroy(query).then(commit, rollback);
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
		return this.transaction((transaction, commit, rollback) => {
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
				}).then(commit, rollback);
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
		// return if the data is empty
		if (_.isEmpty(data[association.as])) {
			return;
		}

		return _.bind(function(transaction) {
			const hash = data[association.as];

			if (!isNaN(hash)) {
				model.set(association.identifier, hash);
				return when.resolve(model);
			}

			// Execute the create/update and assign the foreign keys
			return this.persistAssociation(association, hash).call(this, transaction).then((record) => {
				const key = association.target.primaryKeyAttribute;
				model.set(association.identifier, hash[key] || record.get(key));
				return model;
			});
		}, this);
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
		// return if the data is empty
		if (_.isEmpty(data[association.as])) {
			return;
		}

		const records = data[association.as];

		if (_.isArray(records)) {
			// Create an Array of tasks to be exexuted
			const tasks = _.map(records, function(hash) {
				return _.bind(function(transaction) {
					if (_.isNumber(hash)) {
						hash = {id: hash};
					}

					// Set the foreignKey to the primary key of the association
					hash[association.identifierField] = model.get(association.source.primaryKeyAttribute);

					// Execute the create/update
					return this.persistAssociation(association, hash).call(this, transaction);
				}, this);
			}, this);

			return (transaction) => {
				return parallel(tasks, transaction);
			};
		}
	}

	/**
	 * Resolves and executes the persistance of the Association. First it will
	 * try to resolve is there a specific persitance handler for this Association
	 * Model type, and then tries to execute it inside a Transaction.
	 *
	 * This method returns a Function that is returning a Promise. Function
	 * accepts a Transaction argument.
	 *
	 * @method persistAssociation
	 * @param  {Association} association
	 * @param  {Object}      hash
	 * @return {Function}
	 */
	persistAssociation(association, hash) {
		const model = association.target;
		const id = hash[model.primaryKeyAttribute];

		// Should we create or update the associated model
		const handler = this.resolveAssociationHandler(model.name, id);

		// Assign the task which will accept the transaction
		return _.bind(function(transaction) {
			return handler.call(this, model, hash, transaction);
		}, this);
	}

	/**
	 * Resolves the Association handler for a specific Association Model. Resolves the method
	 * by checking the ID argument if it exists. If ID exists the model should be updated,
	 * in case ID is not defined Model should be created.
	 *
	 * If the method is `create` and name is `User`, the first handler that is searched is
	 * `createUserAssociation`, if the method does not exist, `createAssociation` will be
	 * used.
	 *
	 * Similar is for `update`, it should look for `updateUserAssociation` or `updateAssociation`
	 * if the first one does not exist.
	 *
	 * @method resolveAssociationHandler
	 * @param  {String}        type
	 * @param  {String|Number} id
	 * @return {Function}
	 */
	resolveAssociationHandler(name, id) {
		const method = typeof id === 'undefined' ? 'create' : 'update';
		const keys = [method + name + 'Association', method + 'Association'];

		const available = _.filter(keys, function(key) {
			return typeof this[key] === 'function';
		}, this);

		if (available.length) {
			return this[available[0]];
		}

		throw new TypeError(`Can not find Association Handler for keys [${keys.join(', ')}].`);
	}

	/**
	 * Default Create Association Handler for all Models.
	 *
	 * @method createAssociation
	 * @param  {Model}       model
	 * @param  {Object}      data
	 * @param  {Transaction} transaction
	 * @return {Promise}
	 */
	createAssociation(model, data, transaction) {
		return model.create(data, {
			transaction
		});
	}

	/**
	 * Default Update Association Handler for all Models.
	 *
	 * @method updateAssociation
	 * @param  {Model}       model
	 * @param  {Object}      data
	 * @param  {Transaction} transaction
	 * @return {Promise}
	 */
	updateAssociation(model, data, transaction) {
		return model.update(data, {
			transaction,
			where: {
				id: data.id
			}
		});
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
	transaction(callback) {
		return when.promise((resolve, reject) => {
			this.sequelize.transaction().then((t) => {

				// Rollback transaction
				function rollback(error) {
					t.rollback().then(() => reject(error)).catch(reject);
				}

				// Commit transaction
				function commit(result) {
					t.commit().then(() => resolve(result)).catch(reject);
				}

				if (typeof callback.then === 'function') {
					callback.then(commit, rollback);
				}

				callback(t, commit, rollback);
			});
		});
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
	return service.transaction(function(transaction, commit, rollback) {
		sequence(tasks, transaction).then(commit, rollback);
	}).then(function() {
		return model;
	});
}

module.exports = RestService;
