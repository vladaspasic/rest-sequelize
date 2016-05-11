const _ = require('lodash');
const RestService = require('./rest-service');
const Resolver = require('./resolver');
const RestAdapter = require('./rest-adapter');
const Serializer = require('./serializer');
const Deserializer = require('./deserializer');

/**
 * Rest Sequelize namespace
 *
 * @module rest-sequelize
 * @namespace RestSequelize
 * @param {Sequelize} sequelize Sequelize instance
 * @param {Object}    options Container used by the `DefaultResolver`
 *                              to resolve modules needed by the `RestAdapter`
 */
const RestSequelize = {};

// Expose Classes to the Namespace
RestSequelize.RestService  = RestService;
RestSequelize.RestAdapter  = RestAdapter;
RestSequelize.Serializer   = Serializer;
RestSequelize.Deserializer = Deserializer;
RestSequelize.Resolver     = Resolver;

// Give a nice toString method :)
(function giveToString(keys) {
	_.each(keys, function(name) {
		this[name].toString = function() {
			return 'RestSequelize.' + name;
		};
	}, this);
}).call(RestSequelize, _.keys(RestSequelize) );

module.exports = RestSequelize;
