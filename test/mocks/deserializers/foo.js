var Deserializer = require('../lib/deserializer');

module.exports = Deserializer.extend({
	deserialize: function (adapter, type, payload) {
		return payload;
	}
});
