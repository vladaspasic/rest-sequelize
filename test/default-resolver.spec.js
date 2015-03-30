/* jshint undef: false */
var chai = require('chai'),
	database = require('./server').connect(),
	DefaultResolver = require('../lib/default-resolver'),
	RestService = require('../lib/rest-service'),
	Serializer = require('../lib/serializer'),
	Deserializer = require('../lib/deserializer');

var assert = chai.assert,
	expect = chai.expect;

var resolver = DefaultResolver.create({
	sequelize: database.sequelize
});

describe('DefaultResolver', function() {

	describe('#resolveModel', function() {

		it('should find model User', function() {
			var User = resolver.resolveModel('users');

			assert.deepEqual(User, database.models.User, 'Model User should be the same.');
		});

		it('should not find a model', function() {
			assert.isUndefined(resolver.resolveModel('nomodel'), 'should return an undefined value');
		});

	});

	describe('#resolveService', function() {

		it('should find a default Service', function() {
			assert.instanceOf(resolver.resolveService('users'), RestService, 'Should return an instance of the Service.');
			assert.instanceOf(resolver.resolveService('nomodel'), RestService, 'Should return an instance of the Service.');
		});

	});

	describe('#resolveSerializer', function() {

		it('should find a default Serializer', function() {
			assert.instanceOf(resolver.resolveSerializer('users'), Serializer, 'Should return an instance of the Serializer.');
			assert.instanceOf(resolver.resolveSerializer('nomodel'), Serializer, 'Should return an instance of the Serializer.');
		});

	});

	describe('#resolveModel', function() {

		it('should find a default Deserializer', function() {
			assert.instanceOf(resolver.resolveDeserializer('users'), Deserializer, 'Should return an instance of the Deserializer.');
			assert.instanceOf(resolver.resolveDeserializer('nomodel'), Deserializer, 'Should return an instance of the Deserializer.');
		});

	});

	describe('#resolve', function() {

		it('should throw error for unkown module', function() {
			assert.throw(function() {
				resolver.resolve('unkown', 'no name');
			}, 'Can not resolve factory module for `unkown` with name `no name`.');
		});
	});
});
