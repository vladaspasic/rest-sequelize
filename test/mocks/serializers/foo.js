var Serializer = require('../../../lib/deserializer');

module.exports = Serializer.extend({
	serialize: function (adapter, type, payload) {
		return payload;
	}
});
