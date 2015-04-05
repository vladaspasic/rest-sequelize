var CoreObject = require('./core'),
	_ = require('lodash');

/**
 * Serializer Class used to serialize Sequelize
 * Model attributes.
 *
 * @class  Serializer
 * @extends RestSequelize.Object
 * @namespace RestSequelize
 */
module.exports = CoreObject.extend({
	/**
	 * Serializes the payload obtained from the database to
	 * be flushed to the client.
	 *
	 * By default this function returns a `toJSON` representation
	 * of the Sequelize Model.
	 *
	 * @method serialize
	 * @param  {RestAdapter} adapter
	 * @param  {Model|Array} model
	 * @param  {Object       meta
	 * @param  {Numbser}     statusCode
	 * @return {Object}
	 */
	serialize: function(adapter, model ,meta, statusCode) {
		var serialized;

		if (_.isArray(model)) {
			serialized = _.map(model, serializeRecord);
		} else {
			serialized = serializeRecord(model);
		}

		return {
			result: serialized,
			meta: meta || {},
			status: statusCode || 200
		};
	}
});

function serializeRecord(record) {
	if (_.isFunction(record.toJSON)) {
		return record.toJSON();
	}

	return record;
}
