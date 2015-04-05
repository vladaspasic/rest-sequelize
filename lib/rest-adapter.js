"use strict";
var CoreObject = require('./core'),
	_ = require('lodash'),
	Resolver = require('./resolver'),
	RestService = require('./rest-service'),
	Serializer = require('./serializer'),
	Deserializer = require('./deserializer'),
	errors = require('error-globals');

/**
 * Adapter for defining RESTFull schema for Models. Should handle
 * all CRUD operation runned against a Model.
 *
 * All incoming payloads are normalized, and the serialized
 * into a response object ready for flushing.
 *
 * @class RestAdapter
 * @namespace RestSequelize
 * @extends RestSequelize.Object
 */
var RestAdapter = CoreObject.extend({
	/**
	 * Sequelize instance
	 *
	 * @property sequelize
	 * @type {Sequelize}
	 */
	sequelize: null,

	/**
	 * Resolver subclass that should be used to resolve
	 * modules
	 *
	 * @property resolver
	 * @type {Resolver}
	 */
	Resolver: null,

	init: function() {
		if (!this.sequelize) {
			throw new Error('You must define a sequelize property on the RestAdapter.');
		}

		var ResolverFactory = this.Resolver || Resolver;

		this.resolver = ResolverFactory.create({
			sequelize: this.sequelize
		});
	},

	/**
	 * Find a {{#crossLink "RestSequelize.RestService"}}{{/crossLink}} instance for a given type.
	 * If the {{#crossLink "RestSequelize.Resolver"}}{{/crossLink}} can not resolve a service,
	 * it uses the default implementation.
	 *
	 * @method serviceFor
	 * @param  {String|Model} type
	 * @return {RestSequelize.RestService}
	 */
	serviceFor: function(type) {
		var service = this.resolver.resolveService(type);

		if (!service) {
			service = createDefaultType(this, RestService);
		}

		return service;
	},

	/**
	 * Find a {{#crossLink "RestSequelize.Serializer"}}{{/crossLink}} instance for a given type.
	 * If the {{#crossLink "RestSequelize.Resolver"}}{{/crossLink}} can not resolve a serializer,
	 * it uses the default implementation.
	 *
	 * @method serializerFor
	 * @param  {String} type
	 * @return {RestSequelize.Serializer}
	 */
	serializerFor: function(type) {
		var serializer = this.resolver.resolveSerializer(type);

		if (!serializer) {
			serializer = createDefaultType(this, Serializer);
		}

		return serializer;
	},

	/**
	 * Find a {{#crossLink "RestSequelize.Deserializer"}}{{/crossLink}} instance for a given type.
	 * If the {{#crossLink "RestSequelize.Resolver"}}{{/crossLink}} can not resolve a deserializer,
	 * it uses the default implementation.
	 *
	 * @method deserializerFor
	 * @param  {String} type
	 * @return {RestSequelize.Deserializer}
	 */
	deserializerFor: function(type) {
		var deserializer = this.resolver.resolveDeserializer(type);

		if (!deserializer) {
			deserializer = createDefaultType(this, Deserializer);
		}

		return deserializer;
	},

	/**
	 * Find a Model instance for a given type.
	 *
	 * If a type is not a `String` or a Model can not
	 * be found an Error will be raised.
	 *
	 * @method modelFor
	 * @param  {String|Model} type
	 * @return {Model}
	 */
	modelFor: function modelFor(type) {
		if (isSequelizeModel(type)) {
			return type;
		}

		if (!_.isString(type)) {
			throw new errors.TypeError('Type must be a String or a Sequelize Model. You passed a `%s`.', typeof type);
		}

		var model = this.resolver.resolveModel(type);

		if (!model) {
			throw new errors.NotFoundError('Could not find Model for type `%s`.', type);
		}

		return model;
	},

	/**
	 * Normailizes the incoming payload using the
	 * {{#crossLink "RestSequelize.Deserializer"}}{{/crossLink}}.
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

		var deserializer = this.deserializerFor(type);

		return deserializer.deserialize(this, type, payload);
	},

	/**
	 * Serialize the Sequelize Instance or an Array of Instances
	 * using the  {{#crossLink "RestSequelize.Serializer"}}{{/crossLink}}.
	 *
	 * @method serialize
	 * @param  {String|Model} type
	 * @param  {Object|Array} result
	 * @param  {Object}       meta
	 * @param  {Number}       status
	 * @return {Object}
	 */
	serialize: function(type, result, meta, status) {
		var serializer = this.serializerFor(type);

		return serializer.serialize(this, result, meta, status);
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
				where: _.omit(query, 'page', 'size', 'sort', 'order')
			},
		self = this;

		// Add pagination and sorting, apply defualts if not defined
		applyQueryParams(q, query);

		return this._execute('find', type, q).then(function(result) {
			var models = result.rows;

			return self.serialize(type, models, {
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
		}, self = this;

		return this._execute('findOne', type, query).then(function(result) {
			return self.serialize(type, result);
		});
	},

	/**
	 * Create a new Model record in the Database. If the record is successfully
	 * created, we will reload the model with all the attributes and
	 * associations from the database.
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
	 * If the record is successfully updated, we will reload the model
	 * with all the attributes and associations from the database.
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

		var subResource = this.modelFor(subtype),
			self = this;

		return this._execute('findSubResources', type, id, subResource, query).then(function(records) {
			return self.serialize(type, records);
		});
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

		var subResource = this.modelFor(subtype),
			self = this;

		return this._execute('findSubResources', type, id, subResource, {
			where: {
				id: subId
			}
		}).then(function(results) {
			return self.serialize(type, _.first(results));
		});
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
			subResource = this.modelFor(subtype),
			self = this;

		return this._execute('createSubResources', type, id, subResource, data).then(function(records) {
			return self.serialize(type, records);
		});
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
		if (!isNaN(query)) {
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
});

function isSequelizeModel(type) {
	return _.isString(type.tableName) || typeof type.Instance === 'function';
}

// Resolves the order query for a Model.
// Default `sort` property is `updated_at` and
// `order` is `DESC`.
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

// Resolves the offset, limit and sort for a query.
// Default `offset` is `0` and `limit` is `30`
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

function createDefaultType(adapter, Factory) {
	return Factory.extend({
		sequelize: adapter.sequelize
	}).create();
}

module.exports = RestAdapter;
