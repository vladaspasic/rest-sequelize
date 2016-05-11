"use strict";

/**
 * Error class thrown by the {{#crossLink "RestSequelize.RestAdapet"}}{{/crossLink}}
 *
 * @class RestError
 * @extends {Error}
 * @constructor
 * @param {String} message
 * @param {Number} statusCode
 */
class RestError extends Error {

	constructor(message, statusCode) {
		super(message);

		this.message = message;
		this.statusCode = statusCode || 500;

		Error.call(this, message);
		Error.captureStackTrace(this, RestError);
	}

}

module.exports = RestError;