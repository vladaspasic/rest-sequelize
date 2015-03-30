"use strict";

var CoreObject = require('./core'),
	_ = require('lodash'),
	when = require('when'),
	keys = require('when/keys'),
	errors = require('error-globals'),
	sequence = require('when/sequence'),
	parallel = require('when/parallel');

/**
 * Rest Service for handling Model Persistance logic. Can have
 * multiple implementations for each Model type.
 *
 * @class RestService
 * @extends RestSequelize.Object
 * @namespace RestSequelize
 */
var RestService = CoreObject.extend({
	init: function() {
		if(!this.sequelize) {
			throw new Error('You must define a sequelize property on the RestService.');
		}
	},
	/**
	 * Find a list of Models with all thier
	 * associations for a specific query and
	 * count them.
	 *
	 * @method find
	 * @param  {String}  type
	 * @param  {Object}  query
	 * @return {Promise}
	 */
	find: function(model, query) {
		query = this.populate(model, query || {});

		return keys.all({
			rows: model.findAll(query),
			count: model.count({
				where: query.where
			})
		});
	},

	/**
	 * Find one Model with all its associations
	 * for a specific query.
	 *
	 * @method findOne
	 * @param  {String}  type
	 * @param  {Object}  query
	 * @return {Promise}
	 */
	findOne: function(model, query) {
		query = this.populate(model, query);

		return model.findOne(query).then(function(instance) {
			if (!instance) {
				return when.reject(new errors.NotFoundError('Can not find model `%s`.', model.name));
			}

			return instance;
		});
	},

	findSubResources: function(model, id, subResource, query) {
		return resolveSubresourceInstance(model, id, subResource).then(function(result) {
			var accessor = resolveAccessorMethod(result.instance, result.association, 'get');

			return accessor.call(result.instance, query);
		});
	},

	createSubResources: function(model, id, subResource, data) {
		return this.transaction(function(transaction, commit, rollback) {
			return resolveSubresourceInstance(model, id, subResource).then(function(result) {
				var toUpdate = [],
					toCreate = [];

				var createAccessor = resolveAccessorMethod(result.instance, result.association, 'create'),
					updateAccessor = resolveAccessorMethod(result.instance, result.association, 'addMultiple'),
					options = {
						transaction: transaction
					};

				function resolveEntry(entry) {
					if (entry.id !== undefined) {
						toUpdate.push(entry);
					} else {
						toCreate.push(createAccessor.call(result.instance, entry, options));
					}
				}

				if (_.isArray(data)) {
					_.each(data, resolveEntry);
				} else if (_.isObject(data)) {
					resolveEntry(data);
				} else {
					return when.reject(new errors.BadRequestError('Invalid data sent to the server.'));
				}

				return keys.all({
					updated: updateAccessor.call(result.instance, toUpdate, options),
					created: when.all(toCreate)
				}).then(commit, rollback);
			});
		}).then(function(data) {
			// merge data from mapped promise
			return _.union(data.updated, data.created);
		});
	},

	deleteSubResources: function(model, id, subResource, query) {
		var service = this;

		return resolveSubresourceInstance(model, id, subResource).then(function(result) {
			query.where[result.association.identifierField] = id;

			return service.deleteAll(subResource, query);
		});
	},

	/**
	 * Delete the model for the given id.
	 *
	 * @method delete
	 * @param  {String}  type
	 * @param  {Number}  id
	 * @return {Promise}
	 */
	delete: function(model, id) {
		return model.findOne(id).then(function(instance) {
			if (!instance) {
				return when.reject(new errors.BadRequestError('Can not delete model `%s` with id `%s` as it does not exists.', model.name, id));
			}

			return instance.destroy();
		});
	},

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
	deleteAll: function(model, query) {
		return this.transaction(function(transaction, commit, rollback) {
			if (query === undefined) {
				query = {};
			}

			query.transaction = transaction;

			return model.destroy(query).then(commit, rollback);
		});
	},

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
	transaction: function(callback) {
		var sequelize = this.sequelize;

		return when.promise(function(resolve, reject) {
			sequelize.transaction().then(function(t) {

				// Rollback transaction
				function rollback(error) {
					t.rollback().then(function() {
						return reject(error);
					}, function(e) {
						return reject(new errors.DatabaseError(e, 'Transaction rollback failure'));
					});
				}

				// Commit transaction
				function commit(result) {
					t.commit().then(function() {
						return resolve(result);
					}, reject);
				}

				if (typeof callback.then === 'function') {
					callback.then(commit, rollback);
				}

				callback(t, commit, rollback);
			});
		});
	},

	/**
	 * Include the related records for the given model in the Query.
	 *
	 * @method populate
	 * @param  {Model} model
	 * @param  {Query} query
	 * @return {Query}
	 */
	populate: function(model, query) {
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

		return query;
	},

	/**
	 * Persist the Model with all his Associations to the Database.
	 *
	 * @method persist
	 * @param  {Model}  model
	 * @param  {Object} data
	 * @return {Promise}
	 */
	persist: function persist(model, data) {
		var tasks = [],
			instance = model.build(data, {
				isNewRecord: !data.id
			});

		// Add the task, which will persist the model
		tasks.push(function(transaction) {
			return instance.save({
				validate: !!data.id,
				transaction: transaction
			});
		});

		// Resolve association data
		_.each(model.associations, function(association) {
			var type = association.associationType,
				handler = 'persist' + type;

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
	},

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
	persistBelongsTo: function persistBelongsTo(association, model, data) {
		// return if the data is empty
		if (_.isEmpty(data[association.as])) {
			return;
		}

		return function(transaction) {
			var hash = data[association.as];

			if (!isNaN(hash)) {
				model.set(association.identifier, hash);
				return when.resolve(model);
			}

			// Execute the create/update and assign the foreign keys
			return this.persistAssociation(association, hash).call(this, transaction).then(function(record) {
				var key = association.target.primaryKeyAttribute;
				model.set(association.identifier, hash[key] || record.get(key));
				return model;
			});
		}.bind(this);
	},

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
	persistHasMany: function persistHasMany(association, model, data) {
		// return if the data is empty
		if (_.isEmpty(data[association.as])) {
			return;
		}

		var records = data[association.as];

		if (_.isArray(records)) {

			// Create an Array of tasks to be exexuted
			var tasks = _.map(records, function(hash) {
				return function(transaction) {

					if (!isNaN(hash)) {
						return model[association.accessors.set]([hash]);
					}

					// Set the foreignKey to the primary key of the association
					hash[association.identifier] = model.get(association.source.primaryKeyAttribute);

					// Execute the create/update
					return this.persistAssociation(association, hash).call(this, transaction);
				}.bind(this);
			}, this);

			return function(transaction) {
				return parallel(tasks, transaction);
			};
		}
	},

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
	persistAssociation: function persistAssociation(association, hash) {
		var model = association.target,
			id = hash[model.primaryKeyAttribute];

		// Should we create or update the associated model
		var handler = this.resolveAssociationHandler(model.name, id);

		// Assign the task which will accept the transaction
		return function(transaction) {
			return handler.call(this, model, hash, transaction);
		}.bind(this);
	},

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
	resolveAssociationHandler: function resolveAssociationHandler(name, id) {
		var method = typeof id === 'undefined' ? 'create' : 'update';
		var keys = [method + name + 'Association', method + 'Association'];

		var available = _.filter(keys, function(key) {
			return typeof this[key] === 'function';
		}, this);

		if (available.length) {
			return this[available[0]];
		}

		throw new errors.TypeError('Can not find Association Handler for keys `[%s]`.', keys.join(', '));
	},

	/**
	 * Default Create Association Handler for all Models.
	 *
	 * @method createAssociation
	 * @param  {Model}       model
	 * @param  {Object}      data
	 * @param  {Transaction} transaction
	 * @return {Promise}
	 */
	createAssociation: function createAssociation(model, data, transaction) {
		return model.create(data, {
			transaction: transaction
		});
	},

	/**
	 * Default Update Association Handler for all Models.
	 *
	 * @method updateAssociation
	 * @param  {Model}       model
	 * @param  {Object}      data
	 * @param  {Transaction} transaction
	 * @return {Promise}
	 */
	updateAssociation: function updateAssociation(model, data, transaction) {
		return model.update(data, {
			transaction: transaction,
			where: {
				id: data.id
			}
		});
	}
});

function resolveSubresourceInstance(model, id, subResource) {
	var association = _.find(model.associations, function(association) {
		if (association.target.name === subResource.name) {
			return association;
		}
	});

	if (!association || _.isEmpty(association)) {
		return when.reject(new errors.BadRequestError('No subresource with name `%s` found', subResource));
	}

	return model.find(id).then(function(instance) {
		if (!instance) {
			return when.reject(new errors.NotFoundError('Can not find model `%s`.', model.name));
		}

		return {
			instance: instance,
			association: association
		};
	});
}

function resolveAccessorMethod(instance, association, accessorKey) {
	var accessor = association.accessors[accessorKey];

	if (typeof instance[accessor] !== 'function') {
		throw new errors.TypeError('Model has no accessor method `%s`.', accessor || 'undefined');
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
