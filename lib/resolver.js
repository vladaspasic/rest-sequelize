var CoreObject = require('./core'),
	_ = require('lodash'),
	errors = require('error-globals');

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
module.exports = CoreObject.extend({
	init: function() {
		this._cache = {};
	},
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
	normalizeTypeName: function(name) {
		if(_.isString(name.tableName) || typeof name.Instance === 'function') {
			name = name.options.name.plural;
		}

		if (!_.isString(name)) {
			throw new errors.TypeError('Type name must be a String or a Sequelize Model. ' +
				'You passed a `%s`.', typeof name);
		}

		return name;
	},

	/**
	 * Lookup the Service
	 *
	 * @method resolveService
	 * @param  {String} name Name of the Service implementation
	 * @return {RestSequelize.Service}
	 */
	resolveService: function(name) {
		return resolveAndCache(this, 'services', this.normalizeTypeName(name));
	},

	/**
	 * Lookup the Serializer
	 *
	 * @method resolveSerializer
	 * @param  {String} name Name of the Serializer implementation
	 * @return {RestSequelize.Serializer}
	 */
	resolveSerializer: function(name) {
		return resolveAndCache(this, 'serializers', this.normalizeTypeName(name));
	},

	/**
	 * Lookup the Deserializer
	 *
	 * @method resolveDeserializer
	 * @param  {String} name Name of the Deserializer implementation
	 * @return {RestSequelize.Deserializer}
	 */
	resolveDeserializer: function(name) {
		return resolveAndCache(this, 'deserializers', this.normalizeTypeName(name));
	},

	/**
	 * Lookup the Sequelize Model.
	 * This method is not cached due to the reason that it is looked up
	 * directly on the sequelize instance.
	 *
	 * @method resolveModel
	 * @param  {String} name Name of the Sequelize Model
	 * @return {Model}
	 */
	resolveModel: function(name) {
		if(_.isString(name.tableName) || typeof name.Instance === 'function') {
			return name;
		}

		var model;

		_.each(this.sequelize.models, function(m) {
			if(name.toLowerCase() === m.options.name.plural.toLowerCase()) {
				model = m;
			}
		});

		return model;
	},

	/**
	 * Get a module for a given type and name from
	 * the cache.
	 *
	 * @method getFromCache
	 * @param {String} type Type of the module, it can be
	 *                      `service`, `serializer` or `deserializer`.
	 * @param {String} name Name for a specific module
	 * @return {*}
	 */
	getFromCache: function(type, name) {
		var cacheKey = type + ':' + name;

		return this._cache && this._cache[cacheKey];
	},

	/**
	 * Adds the resolved module for a given type and name
	 * to cache.
	 *
	 * @method addToCache
	 * @param {String} type  Type of the module, it can be
	 *                       `service`, `serializer` or `deserializer`.
	 * @param {String} name  Name for a specific module
	 * @param {*}      value The resolved module
	 */
	addToCache: function(type, name, value) {
		var cacheKey = type + ':' + name;

		if(_.isEmpty(this._cache)) {
			this._cache = {};
		}

		this._cache[cacheKey] = value;
	},

	/**
	 * Clears he cache.
	 *
	 * @method clearCache
	 */
	clearCache: function() {
		this._cache = {};
	},

	/**
	 * Resolves the required module from the
	 * container.
	 *
	 * This method must be implemented by all
	 * extending classes.
	 *
	 * @method resolve
	 * @param {String} type Type of the module, it can be
	 *                      `service`, `serializer` or `deserializer`.
	 * @param {String} name Name for a specific module
	 * @return {*}
	 */
	resolve: function(/* type, name */) {
		return;
	}
});



function resolveAndCache(resolver, type, name) {
	var module = resolver.getFromCache(type, name) || resolver.resolve(type, name);

	if(module) {
		resolver.addToCache(type, name, module);
	}

	return module;
}
