var Serializer = require('../lib/deserializer');

module.exports = Serializer.extend({
	serializer: function (adapter, type, payload) {
		return payload;
	}
});
