var CoreObject = require('./core');

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
	 * @param  {Model}       model
	 * @param  {Object       meta
	 * @param  {Numbser}     statusCode
	 * @return {Object}
	 */
	serialize: function(adapter, model /* ,meta, statusCode */ ) {
		return model.toJSON();
	}
});
