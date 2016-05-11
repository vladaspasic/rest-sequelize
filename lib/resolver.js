"use strict";

const _ = require('lodash');

function resolveAndCache(resolver, sequalize, type, name) {
	name = resolver.normalizeTypeName(name);

	const cache = resolver._cache;
	const key = `${type}:${name}`;

	let module = cache.get(key);

	if(module) {
		return module;
	}

	module = resolver.resolve(sequalize, type, name);

	if(module) {
		cache.set(key, module);
	}

	return module;
}


/**
 * Resolver used by the RestAdapter to find
 * Models, {{#crossLink "RestSequelize.RestService"}}{{/crossLink}},
 * {{#crossLink "RestSequelize.Serializer"}}{{/crossLink}} and
 * {{#crossLink "RestSequelize.Deserializer"}}{{/crossLink}} classes.
 *
 * Uses caching to store and resolve already looked up modules.
 *
 * @class Resolver
 * @extends RestSequelize.Object
 * @namespace RestSequelize
 */
class Resolver {

	constructor() {
		this._cache = new Map();
	}

	/**
	 * Normalizes the type name. Checks if the argument is
	 * a Sequelize model and uses the plural name of the Model.
	 *
	 * This method can usefull for adding prefixes or suffixes
	 * for the searched module.
	 *
	 * @method normalizeTypeName
	 * @param  {String|Model} name
	 * @return {String}
	 */
	normalizeTypeName(name) {
		if(_.isString(name.tableName) || typeof name.Instance === 'function') {
			name = name.options.name.plural;
		}

		if (!_.isString(name)) {
			throw new TypeError(`Type name must be a String or a Sequelize Model. You passed a '${typeof name}'.`);
		}

		return name;
	}

	/**
	 * Lookup and create an instance of the {{#crossLink "RestSequelize.RestService"}}
	 *
	 * @method resolveService
	 * @param  {Sequalize} sequalize Sequalize instance
	 * @param  {String}    name Name of the Service implementation
	 * @return {RestSequelize.Service}
	 */
	resolveService(sequalize, name) {
		return resolveAndCache(this, sequalize, 'services', name);
	}

	/**
	 * Lookup and create an instance of the {{#crossLink "RestSequelize.Serializer"}}
	 *
	 * @method resolveSerializer
	 * @param  {Sequalize} sequalize Sequalize instance
	 * @param  {String}    name Name of the Serializer implementation
	 * @return {RestSequelize.Serializer}
	 */
	resolveSerializer(sequalize, name) {
		return resolveAndCache(this, sequalize, 'serializers', name);
	}

	/**
	 * Lookup and create an instance of the {{#crossLink "RestSequelize.Deserializer"}}
	 *
	 * @method resolveDeserializer
	 * @param  {Sequalize} sequalize Sequalize instance
	 * @param  {String}    name Name of the Deserializer implementation
	 * @return {RestSequelize.Deserializer}
	 */
	resolveDeserializer(sequalize, name) {
		return resolveAndCache(this, sequalize, 'deserializers', name);
	}

	/**
	 * Lookup the Sequelize Model.
	 * This method is not cached due to the reason that it is looked up
	 * directly on the sequelize instance.
	 *
	 * @method resolveModel
	 * @param  {Sequalize} sequalize Sequalize instance
	 * @param  {String}    name Name of the Sequelize Model
	 * @return {Model}
	 */
	resolveModel(sequalize, name) {
		if(_.isString(name.tableName) || typeof name.Instance === 'function') {
			return name;
		}

		let model;

		_.each(sequalize.models, function(m) {
			if(name.toLowerCase() === m.options.name.plural.toLowerCase()) {
				model = m;
			}
		});

		return model;
	}

	/**
	 * Clears he cache.
	 *
	 * @method clearCache
	 */
	clearCache() {
		this._cache.clear();
	}

	/**
	 * Resolves the required module from the
	 * container.
	 *
	 * This method must be implemented by all
	 * extending classes.
	 *
	 * @method resolve
	 * @param {Sequalize} sequalize Sequalize instance
	 * @param {String}    type Type of the module, it can be
	 *                      `service`, `serializer` or `deserializer`.
	 * @param {String}    name Name for a specific module
	 * @return {*}
	 */
	resolve(/* sequalize, type, name */) {
		return null;
	}

}


module.exports = Resolver;