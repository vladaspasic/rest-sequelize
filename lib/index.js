var _ = require('lodash'),
	RestService = require('./rest-service'),
	Resolver = require('./resolver'),
	RestAdapter = require('./rest-adapter'),
	Serializer = require('./serializer'),
	Deserializer = require('./deserializer');

/**
 * Rest Sequelize namespace
 *
 * @module rest-sequelize
 * @namespace RestSequelize
 * @param {Sequelize} sequelize Sequelize instance
 * @param {Object}    options Container used by the `DefaultResolver`
 *                              to resolve modules needed by the `RestAdapter`
 */
var RestSequelize = {};

// Expose Classes to the Namespace
RestSequelize.RestService  = RestService;
RestSequelize.RestAdapter  = RestAdapter;
RestSequelize.Serializer   = Serializer;
RestSequelize.Deserializer = Deserializer;
RestSequelize.Resolver     = Resolver;

RestAdapter.create({
	sequelize: {}
});

// Give a nice toString method :)
(function giveToString(keys) {
	_.each(keys, function(name) {
		this[name].toString = function() {
			return 'RestSequelize.' + name;
		};
	}, this);
}).call(RestSequelize, _.keys(RestSequelize) );

module.exports = RestSequelize;
