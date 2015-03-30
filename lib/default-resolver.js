var _ = require('lodash'),
	Resolver = require('./resolver'),
	DefaultService = require('./rest-service'),
	DefaultSerializer = require('./serializer'),
	DefaultDeserializer = require('./deserializer');

/**
 * Default implementation of the Resolver.
 *
 * This class can only resiolve the default modules.
 *
 * @class DefaultResolver
 * @extends RestSequelize.Resolver
 * @namespace RestSequelize
 */
module.exports = Resolver.extend({

	init: function() {
		this.defaults = {
			services: DefaultService,
			deserializers: DefaultDeserializer,
			serializers: DefaultSerializer
		};

		this._cache = {};
	},

	/**
	 * Resolves the model from the sequelize instance.
	 *
	 * By default it searches through all the sequelize models.
	 *
	 * @method resolveModel
	 * @param  {String} name
	 * @return {Model}
	 */
	resolveModel: function(name) {
		return _.find(this.sequelize.models, function(model) {
			var modelName = model.options.name.plural;

			return modelName.toLowerCase() === name.toLowerCase();
		});
	},

	/**
	 * Returns a default module for a given type.
	 *
	 * @method resolve
	 * @param  {String} type
	 * @return {*}
	 */
	resolve: function(type, name) {
		var Factory = this.defaults[type];

		if (!Factory) {
			throw new Error('Can not resolve factory module for `' + type + '` with name `' + name + '`.');
		}

		return Factory.create({
			sequelize: this.sequelize
		});
	}
});
