"use strict";
var _ = require('lodash'),
	errors = require('error-globals'),
	RestService = require('./rest-service');

/**
 * Adapter for defining RESTFull schema for Models. Should handle
 * all CRUD operation runned against a Model.
 *
 * All inccoming payloads are normalized, and the serialized
 * into a response object ready for flushing.
 *
 * @class RestAdapter
 * @constructor
 * @param {Sequelize} sequelize
 * @param {Object}    services
 */
function RestAdapter(sequelize, services) {
	this.sequelize = sequelize;
	this.services = services || {};
	this._cache = {};
}

RestAdapter.prototype = {
	/**
	 * Find a `RestService` instance for a given type. It defaults
	 * to the 'rest-service:main` general implementation.
	 *
	 * If a type is not a `String` an Error will be raised.
	 *
	 * @modelFor
	 * @param  {String|Model} type
	 * @return {RestService}
	 */
	serviceFor: function(type) {
		// If the Type is Model, resolve the name
		if(isSequelizeModel(type)) {
			type = type.options.name.plural;
		}

		if (!_.isString(type)) {
			throw new errors.TypeError('Type must be a String. You passed a `%s`.', typeof type);
		}

		type = type.toLowerCase();

		var key = 'rest-service:' + type,
			service = this._cache[key];

		if (!service) {
			var Factory = this.services[type];

			if (typeof Factory === 'function') {
				service = new Factory(this.sequelize);
			}

			if (typeof Factory === 'object') {
				Factory = RestService.extend(Factory);
			}
		}

		if (!service) {
			service = new RestService(this.sequelize);
		}

		this._cache[key] = service;

		return service;
	},

	/**
	 * Find a Model instance for a given type.
	 *
	 * If a type is not a `String` or a Model can not
	 * be found an Error will be raised.
	 *
	 * @modelFor
	 * @param  {String|Model} type
	 * @return {Model}
	 */
	modelFor: function modelFor(type) {
		if(isSequelizeModel(type)) {
			return type;
		}

		if (!_.isString(type)) {
			throw new errors.TypeError('Type must be a String or a Sequelize Model. You passed a `%s`.', typeof type);
		}

		var Model = _.find(this.sequelize.models, function(model) {
			var name = model.options.name.plural;

			return name.toLowerCase() === type.toLowerCase();
		});

		if (!Model) {
			throw new errors.NotFoundError('Could not find Model with type `%s`.', type);
		}

		return Model;
	},

	/**
	 * Normailizes the incoming payload coming
	 * from the Request.
	 *
	 * If the payload is empty, a BadRequest Error is raised.
	 *
	 * @method normalizePayload
	 * @param  {String|Model} type
	 * @param  {Object}       payload
	 * @return {Object}
	 */
	normalizePayload: function(type, payload) {
		if (_.isEmpty(payload)) {
			throw new errors.BadRequestError('No data send to the server');
		}

		var data = payload[type];

		if (!data) {
			var model = this.modelFor(type),
				key = model.options.name.singular.toLowerCase();

			data = payload[key];
		}

		if (!data) {
			data = payload;
		}

		return data;
	},

	/**
	 * Serialize the JSON response for the Client
	 *
	 * @param  {Object|Array} result
	 * @param  {Object}       meta
	 * @param  {Number}       status
	 * @return {Object}
	 */
	serialize: function(result, meta, status) {
		return {
			result: result,
			meta: meta || {},
			status: status || 200
		};
	},

	/**
	 * Preapre the raw query parameters from the request into
	 * a Sequelize Query. Then find all results that match this query.
	 *
	 * @method find
	 * @param  {String|Model} type
	 * @param  {Object}       query
	 * @return {Promise}
	 */
	find: function(type, query) {
		var q = {
				where: _.omit(query, 'page', 'size', 'sort', 'order', 'limit', 'offset', 'count')
			},
			self = this;

		// Add pagination and sorting, apply defualts if not defined
		applyQueryParams(q, query);

		return this._execute('find', type, q).then(function(result) {
			var models = result.rows;

			return self.serialize(models, {
				size: models.length,
				page: parseInt(query.page, 10),
				totalSize: result.count,
				totalPages: Math.ceil(result.count / query.size)
			});
		});
	},

	/**
	 * Find a Model for a specific id.
	 *
	 * If `id` is not a Number, a TypeError is raised.
	 *
	 * @method findOne
	 * @param  {String|Model} type
	 * @param  {Number}       id
	 * @return {Promise}
	 */
	findById: function(type, id) {
		if (_.isNaN(id)) {
			throw new TypeError('You must pass a Number as an ID.');
		}

		var query = {
			where: {
				id: id
			}
		};

		return this._execute('findOne', type, query).then(this.serialize);
	},

	/**
	 * Create a new Model record in the Database.
	 *
	 * @method create
	 * @param  {String|Model} type
	 * @param  {Object}       payload
	 * @return {Promise}
	 */
	create: function(type, payload) {
		var data = this.normalizePayload(type, payload),
			self = this;

		return this._execute('persist', type, data).then(function(model) {
			return self.findById(type, model.id);
		});
	},

	/**
	 * Updates a new Model record in the Database for the given id.
	 *
	 * If id is an object, it is considered to be a payload
	 * object to be normalized.
	 *
	 * @method update
	 * @param  {String|Model} type
	 * @param  {Number}       id
	 * @param  {Object}       payload
	 * @return {Promise}
	 */
	update: function(type, id, payload) {
		if (arguments.length === 2) {
			payload = id;
			id = null;
		}

		var data = this.normalizePayload(type, payload),
			self = this;

		if (!_.isNaN(id)) {
			data.id = id;
		}

		if (!id && !data.id) {
			throw new errors.BadRequestError('Can update a model `%s` without specifing its id.', type);
		}

		return this._execute('persist', type, data).then(function(model) {
			return self.findById(type, model.id);
		});
	},

	/**
	 * Delete the model for the given id.
	 *
	 * @method delete
	 * @param  {String|Model} type
	 * @param  {Number}       id
	 * @return {Promise}
	 */
	delete: function(type, id) {
		if (_.isNaN(id)) {
			throw new TypeError('You must pass a Number as an ID.');
		}

		return this._execute('delete', type, id);
	},

	/**
	 * Find all Related Models [Subresources] for a Model.
	 *
	 * @method findSubResources
	 * @param  {String|Model} type
	 * @param  {Numebr}       id
	 * @param  {String|Model}  subtype
	 * @param  {Object}       query
	 * @return {Promise}
	 */
	findSubResources: function(type, id, subtype, query) {
		if (arguments.length === 3) {
			query = {};
		}

		var subResource = this.modelFor(subtype);

		return this._execute('findSubResources', type, id, subResource, query).then(this.serialize);
	},

	/**
	 * Find a Related Model [Subresources] for a Model with a given id.
	 *
	 * @method findSubResourceById
	 * @param  {String|Model} type
	 * @param  {Numebr}       id
	 * @param  {String|Model} subtype
	 * @param  {Number}       subId
	 * @return {Promise}
	 */
	findSubResourceById: function(type, id, subtype, subId) {
		if (!subId) {
			throw new errors.TypeError('You must define a subresource id');
		}

		var subResource = this.modelFor(subtype);

		return this._execute('findSubResources', type, id, subResource, {
			where: {
				id: subId
			}
		}).then(function(results) {
			return _.first(results);
		}).then(this.serialize);
	},

	/**
	 * Creates new or updates existing associations for a Model.
	 *
	 * If the payload contains records with an id, they are considered
	 * as existing and they will be updated. If there is no id, a new
	 * record will be created.
	 *
	 * @method createSubResources
	 * @param  {String|Model} type
	 * @param  {Numebr}       id
	 * @param  {String|Model} subtype
	 * @param  {Object}       payload
	 * @return {Promise}
	 */
	createSubResources: function(type, id, subtype, payload) {
		var data = this.normalizePayload(type, payload),
			subResource = this.modelFor(subtype);

		return this._execute('createSubResources', type, id, subResource, data).then(this.serialize);
	},

	/**
	 * Find a Related Model [Subresources] for a Model with a given id.
	 *
	 * @method deleteSubResources
	 * @param  {String|Model}  type
	 * @param  {Numebr}        id
	 * @param  {String|Model}  subtype
	 * @param  {Object|Number} query
	 * @return {Promise}
	 */
	deleteSubResources: function(type, id, subtype, query) {
		if(!isNaN(query)) {
			query = {
				id: query
			};
		}

		var q = {
			where: query || {}
		};

		var subResource = this.modelFor(subtype);

		return this._execute('deleteSubResources', type, id, subResource, q);
	},

	/**
	 * Execute a given action on the Service
	 * responsible for this Model type.
	 *
	 * @method _execute
	 * @param  {String}  method
	 * @param  {String}  type
	 * @param  {Object}  data
	 * @return {Promise}
	 * @private
	 */
	_execute: function(method, type) {
		var model = this.modelFor(type),
			service = this.serviceFor(type);

		if (!_.isFunction(service[method])) {
			throw new Error('Can not execute method ' + method + ' on a service, as it is not a function.');
		}

		var args = _.toArray(arguments);
		// remove method and type arguments
		args.splice(0, 2);
		// add model argument
		args.unshift(model);

		return service[method].apply(service, args);
	}
};

function isSequelizeModel(type) {
	return _.isString(type.tableName) || typeof type.Instance === 'function';
}

/**
 * Resolves the order query for a Model.
 *
 * Default `sort` property is `updated_at` and
 * `order` is `DESC`.
 *
 * @param  {Object} query
 * @return {String}
 */
function resolveOrder(query) {
	if (query.sort === undefined) {
		return query.sort;
	}

	var orders = ['ASC', 'DESC'];
	var order = (query.order || 'DESC').toUpperCase();

	if (!_.contains(orders, order)) {
		order = 'DESC';
	}

	return query.sort + ' ' + order;
}

/**
 * Resolves the offset, limit and sort for a query.
 *
 * Default `offset` is `0` and `limit` is `30`
 *
 * @param  {Object} query
 * @param  {Object} params
 * @return {String}
 */
function applyQueryParams(query, params) {
	_.defaults(params, {
		page: 1,
		size: 30
	});

	var currentPage = parseInt(params.page, 10),
		size = parseInt(params.size, 10);

	query.offset = (currentPage - 1) * size;
	query.limit = size;
	query.order = resolveOrder(params);
}

module.exports = RestAdapter;
