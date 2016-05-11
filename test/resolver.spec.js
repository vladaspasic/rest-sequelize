/* globals describe, it */
"use strict";

const chai = require('chai');
const database = require('./server').connect();
const Resolver = require('../lib/resolver');
const RestService = require('../lib/rest-service');
const Deserializer = require('../lib/deserializer');

class MockResolver extends Resolver {

	resolve(sequelize, type, name) {
		let Factory;

		const location = `./mocks/${type}/${name}`;

		try {
			Factory = require(location);
		} catch (e) {
			
			// console.warn(`could not find Factory ${type}:${name} in ${location}`, e.stack);
			
			return;
		}

		return new Factory(sequelize);
	}

}
const assert = chai.assert;
const DB = database.sequelize;
const resolver = new MockResolver(DB);

describe('Resolver', function() {

	describe('#resolveModel', function() {

		it('should find model User', function() {
			const User = resolver.resolveModel(DB, 'users');

			assert.deepEqual(User, database.models.User, 'Model User should be the same.');
		});

		it('should not find a model', function() {
			assert.isUndefined(resolver.resolveModel(DB, 'nomodel'), 'should return an undefined value');
		});

		it('should resolve model', function() {
			assert.deepEqual(resolver.resolveModel(DB, 'users'), database.sequelize.models.User, 'Should return a user Model.');
			assert.deepEqual(resolver.resolveModel(DB, 'foos'), database.sequelize.models.Foo, 'Should return a Foo Model.');
		});

		it('should return an undefined', function() {
			assert.isUndefined(resolver.resolveModel(DB, 'nomodel'), 'Should return undefined.');
		});

	});

	describe('#resolveService', function() {

		it('should find a user Service', function() {
			const userService = resolver.resolveService(DB, 'users');
			const UserService = require('./mocks/services/users');

			assert.instanceOf(userService, UserService, 'Should return an instance of the UserService.');
			assert.instanceOf(userService, RestService, 'Should return an instance of the RestService.');
			assert.deepEqual(userService, resolver.resolveService(DB, 'users'), 'Should return a cached instance of the UserService.');
		});

	});

	describe('#resolveSerializer', function() {

		it('should find a Foo Serializer', function() {
			const fooSerializer = resolver.resolveSerializer(DB, 'foo');
			const FooSerializer = require('./mocks/serializers/foo');

			//assert.instanceOf(fooSerializer, Serializer, 'Should return an instance of the Serializer.');
			assert.instanceOf(fooSerializer, FooSerializer, 'Should return an instance of the FooSerializer.');
			assert.deepEqual(fooSerializer, resolver.resolveSerializer(DB, 'foo'), 'Should return a cached instance of the Serializer.');
		});

		it('should return an undefined', function() {
			assert.isUndefined(resolver.resolveSerializer(DB, 'nomodel'), 'Should return undefined.');
		});

	});

	describe('#resolveDeserializer', function() {

		it('should find a Foo Deserializer', function() {
			const fooDeserializer = resolver.resolveDeserializer(DB, 'foo');
			const FooDeserializer = require('./mocks/deserializers/foo');

			assert.instanceOf(fooDeserializer, Deserializer, 'Should return an instance of the Deserializer.');
			assert.instanceOf(fooDeserializer, FooDeserializer, 'Should return an instance of the FooDeserializer.');
			assert.deepEqual(fooDeserializer, resolver.resolveDeserializer(DB, 'foo'), 'Should return a cached instance of the Deserializer.');
		});

		it('should return an undefined', function() {
			assert.isUndefined(resolver.resolveDeserializer(DB, 'nomodel'), 'Should return undefined.');
		});

	});

	describe('#clearCache', function() {
		it('should clear cache', function() {
			resolver.clearCache();

			assert.deepEqual(resolver._cache.size, 0, 'Cache should be empty');
		});
	});

	describe('#resolve', function() {
		it('should return undefined for unkown module', function() {
			assert.isUndefined(resolver.resolve(DB, 'unkown', 'no name'), 'Should return undefined for unkown module.');
		});
	});
});
