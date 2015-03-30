var CoreObject = require('./core');

/**
 * Deserializer Class used for deserialization
 * of incoming payloads.
 *
 * @class Deserializer
 * @extends RestSequelize.Object
 * @namespace RestSequelize
 */
module.exports = CoreObject.extend({
	/**
	 * Deserializes the incoming payload to a
	 * data that will later be used to populate
	 * Sequelize Model attributes.
	 *
	 * By default raw payload is returned.
	 *
	 * @method deserialize
	 * @param  {RestAdapter} adapter
	 * @param  {String}      type
	 * @param  {Object}      payload
	 * @return {Object}
	 */
	deserialize: function(adapter, type, payload) {
		return payload;
	}
});
