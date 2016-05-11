"use strict";

var Serializer = require('../../../lib/serializer');

class SerializerMock extends Serializer {

	deserialize(adapter, type, payload) {
		return payload;
	}

}

module.exports = SerializerMock;
