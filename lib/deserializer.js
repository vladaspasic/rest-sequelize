"use strict";

/**
 * Deserializer Class used for deserialization
 * of incoming payloads.
 *
 * @class Deserializer
 * @namespace RestSequelize
 */
class Deserializer {
	
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
	deserialize(adapter, type, payload) {
		return payload;
	}
}

module.exports = Deserializer;
