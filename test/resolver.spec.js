/* jshint undef: false */
var chai = require('chai'),
	database = require('./server').connect(),
	Resolver = require('../lib/resolver'),
	RestService = require('../lib/rest-service'),
	Serializer = require('../lib/serializer'),
	Deserializer = require('../lib/deserializer');

var assert = chai.assert,
	expect = chai.expect;

var resolver = Resolver.extend({
	sequelize: database.sequelize,
	resolve: function(type, name) {
		 var Factory;

		 console.log('Resolver PATH', ('./mocks/' + type + '/' + name));

        try {
            Factory = require('./mocks/' + type + '/' + name);
        } catch(e) {
            return;
        }

        return Factory.extend({
            sequelize: this.sequelize
        }).create();
	}
}).create();

describe('Resolver', function() {

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

		it('should find a user Service', function() {
			var userService = resolver.resolveService('users'),
				UserService = require('./mocks/services/users');

			assert.instanceOf(userService, UserService, 'Should return an instance of the UserService.');
			assert.instanceOf(userService, RestService, 'Should return an instance of the RestService.');
			assert.deepEqual(userService, resolver.resolveService('users'), 'Should return a cached instance of the UserService.');
		});

	});

	describe('#resolveSerializer', function() {

		it('should find a Foo Serializer', function() {
			var fooSerializer = resolver.resolveSerializer('foo'),
				FooSerializer = require('./mocks/serializers/foo');

			//assert.instanceOf(fooSerializer, Serializer, 'Should return an instance of the Serializer.');
			assert.instanceOf(fooSerializer, FooSerializer, 'Should return an instance of the FooSerializer.');
			assert.deepEqual(fooSerializer, resolver.resolveSerializer('foo'), 'Should return a cached instance of the Serializer.');
		});

		it('should return an undefined', function() {
			assert.isUndefined(resolver.resolveSerializer('nomodel'), 'Should return undefined.');
		});

	});

	describe('#resolveDeserializer', function() {

		it('should find a Foo Deserializer', function() {
			var fooDeserializer = resolver.resolveDeserializer('foo'),
				FooDeserializer = require('./mocks/deserializers/foo');

			assert.instanceOf(fooDeserializer, Deserializer, 'Should return an instance of the Deserializer.');
			assert.instanceOf(fooDeserializer, FooDeserializer, 'Should return an instance of the FooDeserializer.');
			assert.deepEqual(fooDeserializer, resolver.resolveDeserializer('foo'), 'Should return a cached instance of the Deserializer.');
		});

		it('should return an undefined', function() {
			assert.isUndefined(resolver.resolveDeserializer('nomodel'), 'Should return undefined.');
		});

	});

	describe('#resolveModel', function() {

		it('should resolve model', function() {
			assert.deepEqual(resolver.resolveModel('users'), database.sequelize.models.User, 'Should return a user Model.');
			assert.deepEqual(resolver.resolveModel('foos'), database.sequelize.models.Foo, 'Should return a Foo Model.');		});

		it('should return an undefined', function() {
			assert.isUndefined(resolver.resolveModel('nomodel'), 'Should return undefined.');
		});
	});

	describe('#getFromCache', function() {
		it('should get a cache entry', function() {
			var value = 'Testing value';

			resolver.addToCache('myType', 'myName', value);

			assert.deepEqual(resolver.getFromCache('myType', 'myName'), value, 'Cache entry should be equal.');
		});

		it('should get no cache entries', function() {
			assert.isUndefined(resolver.getFromCache('noType', 'noName'), 'No Cache entry should be returned.');
		});
	});

	describe('#addToCache', function() {
		it('should have a cache entry', function() {
			var value = 'Testing value';

			resolver.addToCache('myType', 'myName', value);

			assert.deepEqual(resolver.getFromCache('myType', 'myName'), value, 'Cache entry should be equal.');
			assert.deepEqual(resolver._cache['myType:myName'], value, 'Cache entry should be equal.');
		});
	});

	describe('#clearCache', function() {
		it('should clear cache', function() {
			resolver.clearCache();

			assert.deepEqual(resolver._cache, {}, 'Cache should be empty');
		});
	});

	describe('#resolve', function() {

		it('should return undefined for unkown module', function() {
			assert.isUndefined(resolver.resolve('unkown', 'no name'), 'Should return undefined for unkown module.');
		});
	});
});
