"use strict";

var Deserializer = require('../../../lib/deserializer');

class DeserializerMock extends Deserializer {

	deserialize(adapter, type, payload) {
		return payload;
	}

}

module.exports = DeserializerMock;
