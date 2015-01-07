var _ = require('lodash'),
	RestAdapter = require('./rest-adapter');

module.exports = function(sequelize, options) {
	options = _.defaults(options || {}, {
		services: {}
	});

	return new RestAdapter(sequelize, options.services);
};
