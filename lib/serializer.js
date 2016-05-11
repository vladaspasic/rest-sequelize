"use strict";

const _ = require('lodash');

/**
 * Serializer Class used to serialize Sequelize
 * Model attributes.
 *
 * @class  Serializer
 * @extends RestSequelize.Object
 * @namespace RestSequelize
 */
class Serializer {

	/**
	 * Serializes the payload obtained from the database to
	 * be flushed to the client.
	 *
	 * By default this function returns a `toJSON` representation
	 * of the Sequelize Model.
	 *
	 * @method serialize
	 * @param  {RestAdapter}    adapter
	 * @param  {Model}          model
	 * @param  {Instance|Array} payload
	 * @param  {Object          meta
	 * @param  {Numbser}        status
	 * @return {Object}
	 */
	serialize(adapter, model, payload, meta, status) {
		let serialized;

		if (_.isArray(payload)) {
			serialized = _.map(payload, (record) => this.serializeRecord(record) );
		} else {
			serialized = this.serializeRecord(payload);
		}

		meta = meta || {};
		status = status || 200;

		return {
			result: serialized,
			meta, status
		};
	}

	/**
	 * Serializes a single record.
	 * 
	 * @param  {Instance} record
	 * @return {Object}
	 */
	serializeRecord(record) {
		if (_.isFunction(record.toJSON)) {
			return record.toJSON();
		}

		return record;
	}

}

module.exports = Serializer;