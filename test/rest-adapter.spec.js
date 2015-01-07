/* jshint undef: false */
var chai = require('chai'),
	database = require('./server').connect(),
	RestService = require('../lib/rest-service'),
	RestAdapter = require('../lib/rest-adapter');

var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

var assert = chai.assert,
	expect = chai.expect,
	FooService = RestService.extend({});

var Adapter = new RestAdapter(database.sequelize, {
	'foos': FooService
}),
	User = database.models.User,
	Task = database.models.Task;

describe('RestAdapter', function() {

	describe('#serviceFor', function() {

		it('should resolve default service', function() {
			var service = Adapter.serviceFor('users');

			assert.instanceOf(service, RestService, 'Should be an instance of RestService');
		});

		it('should resolve Foo service', function() {
			var service = Adapter.serviceFor('foos');

			assert.instanceOf(service, FooService, 'Should be an instance of FooService');
			assert.instanceOf(service, RestService, 'Should be an instance of RestService');
		});

		it('should throw error', function() {
			assert.throw(function() {
				Adapter.serviceFor(function() {});
			}, 'Type must be a String. You passed a `function`.');

			assert.throw(function() {
				Adapter.serviceFor(1);
			}, 'Type must be a String. You passed a `number`.');

			assert.throw(function() {
				Adapter.serviceFor({});
			}, 'Type must be a String. You passed a `object`.');

			assert.throw(function() {
				Adapter.serviceFor([]);
			}, 'Type must be a String. You passed a `object`.');
		});
	});

	describe('#modelFor', function() {
		it('should resolve a model', function() {
			var model = Adapter.modelFor('users');

			assert.instanceOf(model, database.Sequelize.Model, 'Should be an instance of a Model');

			model = Adapter.modelFor('tasks');

			assert.instanceOf(model, database.Sequelize.Model, 'Should be an instance of a Model');

			model = Adapter.modelFor('foos');

			assert.instanceOf(model, database.Sequelize.Model, 'Should be an instance of a Model');
		});

		it('should throw error', function() {
			assert.throw(function() {
				Adapter.modelFor('bars');
			}, 'Could not find Model with type `bars`.');

			assert.throw(function() {
				Adapter.modelFor(function() {});
			}, 'Type must be a String. You passed a `function`.');

			assert.throw(function() {
				Adapter.modelFor(1);
			}, 'Type must be a String. You passed a `number`.');

			assert.throw(function() {
				Adapter.modelFor({});
			}, 'Type must be a String. You passed a `object`.');

			assert.throw(function() {
				Adapter.modelFor([]);
			}, 'Type must be a String. You passed a `object`.');
		});
	});

	describe('#find', function() {

	});

	describe('#findById', function() {

	});

	describe('#create', function() {

	});

	describe('#update', function() {

	});

	describe('#delete', function() {

	});

});
