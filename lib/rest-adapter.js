"use strict";

const _ = require('lodash');
const Resolver = require('./resolver');
const RestService = require('./rest-service');
const Serializer = require('./serializer');
const Deserializer = require('./deserializer');
const RestError = require('./error');

/**
 * Default {{#crossLink "RestSequelize.Resolver"}}{{/crossLink}} used
 * by the {{#crossLink "RestSequelize.RestAdapter"}}{{/crossLink}} when
 * no custom one is defined.
 *
 * @class DefaultResolver
 * @extends RestSequelize.Resolver
 */
class DefaultResolver extends Resolver {

	resolve(sequelize, type, name) {

		let FactoryClass;

		switch(type) {
			case 'services':
				FactoryClass = RestService; break;
			case 'serializers':
				FactoryClass = Serializer; break;
			case 'deserializers':
				FactoryClass = Deserializer; break;
			default:
				throw new Error(`Could not resolve with type '${type}' and name ${name}`);
		}

		return new FactoryClass(sequelize);
	}
}

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
 * @constructor
 * @param {Sequelize} sequelize
 * @param {Resolver}  resolver
 */
class RestAdapter {

	constructor(sequelize, resolver) {
		if(_.isUndefined(sequelize)) {
			throw new Error('You must pass a Sequelize instance when creating RestAdapter instance.');
		}

		if(_.isUndefined(resolver)) {
			resolver = new DefaultResolver();
		}

		this.sequelize = sequelize;
		this.resolver = resolver;
	}

	/**
	 * Find a {{#crossLink "RestSequelize.RestService"}}{{/crossLink}} instance for a given type.
	 * If the {{#crossLink "RestSequelize.Resolver"}}{{/crossLink}} can not resolve a service,
	 * it uses the default implementation.
	 *
	 * @method serviceFor
	 * @param  {String|Model} type
	 * @return {RestSequelize.RestService}
	 */
	serviceFor(type) {
		return this.resolver.resolveService(this.sequelize, type);
	}

	/**
	 * Find a {{#crossLink "RestSequelize.Serializer"}}{{/crossLink}} instance for a given type.
	 * If the {{#crossLink "RestSequelize.Resolver"}}{{/crossLink}} can not resolve a serializer,
	 * it uses the default implementation.
	 *
	 * @method serializerFor
	 * @param  {String} type
	 * @return {RestSequelize.Serializer}
	 */
	serializerFor(type) {
		return this.resolver.resolveSerializer(this.sequelize, type);
	}

	/**
	 * Find a {{#crossLink "RestSequelize.Deserializer"}}{{/crossLink}} instance for a given type.
	 * If the {{#crossLink "RestSequelize.Resolver"}}{{/crossLink}} can not resolve a deserializer,
	 * it uses the default implementation.
	 *
	 * @method deserializerFor
	 * @param  {String} type
	 * @return {RestSequelize.Deserializer}
	 */
	deserializerFor(type) {
		return this.resolver.resolveDeserializer(this.sequelize, type);
	}

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
	modelFor(type) {
		if (isSequelizeModel(type)) {
			return type;
		}

		if (!_.isString(type)) {
			throw new TypeError(`Type must be a String or a Sequelize Model. You passed a '${typeof type}'.`);
		}

		const model = this.resolver.resolveModel(this.sequelize, type);

		if (!model) {
			throw new RestError(`Could not find Model for type ${type}.`, 404);
		}

		return model;
	}

	/**
	 * Preapre the raw query parameters from the request into
	 * a Sequelize Query. Then find all results that match this query.
	 *
	 * @method find
	 * @param  {String|Model} type
	 * @param  {Object}       where
	 * @param  {Object}       pageable
	 * @return {Promise}
	 */
	find(type, where, pageable) {
		pageable = applyDefaultPageable(pageable);
		const query = _.assign({}, pageable, {
			where
		});

		return this._execute('find', type, query).then((result) => {
			const models = result.rows;
			const serializer = this.serializerFor(type);

			return serializer.serialize(this, type, models, {
				size: models.length,
				page: parseInt(query.page, 10),
				totalSize: result.count,
				totalPages: Math.ceil(result.count / query.size)
			});
		});
	}

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
	findById(type, id) {
		if (_.isNaN(id)) {
			throw new TypeError('You must pass a Number as an ID.');
		}

		const query = {
			where: {
				id: id
			}
		};

		return this._execute('findOne', type, query).then((result) => {
			const serializer = this.serializerFor(type);
			return serializer.serialize(this, type, result);
		});
	}

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
	create(type, payload) {
		const deserializer = this.deserializerFor(type);
		const data = deserializer.deserialize(this, type, payload);

		return this._execute('persist', type, data).then((model) => {
			return this.findById(type, model.id);
		});
	}

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
	update(type, id, payload) {
		if (arguments.length === 2) {
			payload = id;
			id = null;
		}

		const deserializer = this.deserializerFor(type);
		const data = deserializer.deserialize(this, type, payload);

		if (!_.isNaN(id)) {
			data.id = id;
		}

		if (!id && !data.id) {
			throw new RestError(`Can not update a model ${type} without specifing its' id.`, 400);
		}

		return this._execute('persist', type, data).then((model) => {
			return this.findById(type, model.id);
		});
	}

	/**
	 * Delete the model for the given id.
	 *
	 * @method delete
	 * @param  {String|Model} type
	 * @param  {Number}       id
	 * @return {Promise}
	 */
	delete(type, id) {
		if (_.isNaN(id)) {
			throw new RestError('You must pass a Number as an ID.', 400);
		}

		return this._execute('delete', type, id);
	}

	/**
	 * Find all Related Models [Subresources] for a Model.
	 *
	 * @method findSubResources
	 * @param  {String|Model} type
	 * @param  {Numebr}       id
	 * @param  {String|Model}  subtype
	 * @return {Promise}
	 */
	findSubResources(type, id, subtype) {
		const subResource = this.modelFor(subtype);

		return this._execute('findSubResources', type, id, subResource).then((records) => {
			const serializer = this.serializerFor(subtype);
			return serializer.serialize(this, subtype, records);
		});
	}

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
	findSubResourceById(type, id, subtype, subId) {
		if (!subId) {
			throw new RestError('You must define a subresource id', 400);
		}

		const subResource = this.modelFor(subtype);

		return this._execute('findSubResources', type, id, subResource, {
			id: subId
		}).then((records) => {
			const serializer = this.serializerFor(subtype);
			return serializer.serialize(this, subtype, _.first(records));
		});
	}

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
	createSubResources(type, id, subtype, payload) {
		const subResource = this.modelFor(subtype);
		const deserializer = this.deserializerFor(subtype);
		const data = deserializer.deserialize(this, subtype, payload);

		return this._execute('createSubResources', type, id, subResource, data).then((records) => {
			const serializer = this.serializerFor(subtype);
			return serializer.serialize(this, subtype, records);
		});
	}

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
	deleteSubResources(type, id, subtype, query) {
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
	}

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
	_execute(method, type) {
		const model = this.modelFor(type);
		const service = this.serviceFor(type);

		if (!_.isFunction(service[method])) {
			throw new Error(`Can not execute method '${method}' on a service, as it is not a function.`);
		}

		const args = _.toArray(arguments);
		// remove method and type arguments
		args.splice(0, 2);
		// add model argument
		args.unshift(model);

		return service[method].apply(service, args);
	}

}

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
function applyDefaultPageable(pageable) {
	pageable = _.defaults({}, pageable, {
		page: 1,
		size: 30
	});

	const currentPage = parseInt(pageable.page, 10);
	const size = parseInt(pageable.size, 10);

	pageable.offset = (currentPage - 1) * size;
	pageable.limit = size;
	pageable.order = resolveOrder(pageable);

	return pageable;
}

module.exports = RestAdapter;
