var CoreObject = require('./core'),
	_ = require('lodash');

/**
 * Resolver used by the RestAdapter to find
 * Models, {{#crossLink "RestSequelize.RestService"}}{{/crossLink}},
 * {{#crossLink "RestSequelize.Serializer"}}{{/crossLink}} and
 * {{#crossLink "RestSequelize.Deserializer"}}{{/crossLink}} classes.
 *
 * @class Resolver
 * @extends RestSequelize.Object
 * @namespace RestSequelize
 */
module.exports = CoreObject.extend({
	/**
	 * Normalizes the name, usefull for adding
	 * prefixes or suffixes for the searched module.
	 *
	 * By default this method returns the same string.
	 *
	 * @method normalizeName
	 * @param  {String} name
	 * @return {String}
	 */
	normalizeName: function(name) {
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
		return this.resolve('services', name);
	},

	/**
	 * Lookup the Serializer
	 *
	 * @method resolveSerializer
	 * @param  {String} name Name of the Serializer implementation
	 * @return {RestSequelize.Serializer}
	 */
	resolveSerializer: function(name) {
		return this.resolve('serializers', name);
	},

	/**
	 * Lookup the Deserializer
	 *
	 * @method resolveDeserializer
	 * @param  {String} name Name of the Deserializer implementation
	 * @return {RestSequelize.Deserializer}
	 */
	resolveDeserializer: function(name) {
		return this.resolve('deserializers', name);
	},

	/**
	 * Lookup the Sequelize Model
	 *
	 * @method resolveModel
	 * @param  {String} name Name of the Sequelize Model
	 * @return {Model}
	 */
	resolveModel: function(name) {
		return this.resolve('models', this.normalizeName(name));
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
	resolve: function(type, name) {
		throw new Error('You must implement the `resolve` method.');
	}
});
