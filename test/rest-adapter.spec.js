/* globals describe, it */
"use strict";

const chai = require('chai');
const database = require('./server').connect();
const RestService = require('../lib/rest-service');
const RestAdapter = require('../lib/rest-adapter');

const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

const assert = chai.assert;

const Adapter = new RestAdapter(database.sequelize);
const User = database.models.User;
const Task = database.models.Task;

describe('RestAdapter', function() {

	describe('#serviceFor', function() {

		it('should resolve default service', function() {
			const service = Adapter.serviceFor('users');

			assert.instanceOf(service, RestService, 'Should be an instance of RestService');
			assert.deepEqual(service, Adapter.serviceFor('users'), 'Service should be equal.');
		});

		it('should resolve Foo service', function() {
			const service = Adapter.serviceFor('foos');

			assert.instanceOf(service, RestService, 'Should be an instance of RestService');
			assert.deepEqual(service, Adapter.serviceFor('foos'), 'Service should be equal.');
		});

		it('should throw error', function() {
			assert.throw(function() {
				Adapter.serviceFor(function() {});
			}, 'Type name must be a String or a Sequelize Model. You passed a \'function\'.');

			assert.throw(function() {
				Adapter.serviceFor(1);
			}, 'Type name must be a String or a Sequelize Model. You passed a \'number\'.');

			assert.throw(function() {
				Adapter.serviceFor({});
			}, 'Type name must be a String or a Sequelize Model. You passed a \'object\'.');

			assert.throw(function() {
				Adapter.serviceFor([]);
			}, 'Type name must be a String or a Sequelize Model. You passed a \'object\'.');
		});
	});

	describe('#modelFor', function() {
		it('should resolve a model as a String', function() {
			const msg = 'Should be an instance of a Model';
			assert.instanceOf(User, database.Sequelize.Model, msg);
			assert.instanceOf(Task, database.Sequelize.Model, msg);

			assert.equal(User, User, msg);
			assert.equal(Task, Task, msg);
		});

		it('should resolve a model as a Model', function() {
			const msg = 'Should be an instance of a Model';

			assert.instanceOf(Adapter.modelFor('users'), database.Sequelize.Model, msg);
			assert.instanceOf(Adapter.modelFor('TASKS'), database.Sequelize.Model, msg);
			assert.instanceOf(Adapter.modelFor('FoOs'), database.Sequelize.Model, msg);
		});

		it('should throw error', function() {
			assert.throw(function() {
				Adapter.modelFor('bars');
			}, 'Could not find Model for type bars.');

			assert.throw(function() {
				Adapter.modelFor(function() {});
			}, 'Type must be a String or a Sequelize Model. You passed a \'function\'.');

			assert.throw(function() {
				Adapter.modelFor(1);
			}, 'Type must be a String or a Sequelize Model. You passed a \'number\'.');

			assert.throw(function() {
				Adapter.modelFor({});
			}, 'Type must be a String or a Sequelize Model. You passed a \'object\'.');

			assert.throw(function() {
				Adapter.modelFor([]);
			}, 'Type must be a String or a Sequelize Model. You passed a \'object\'.');
		});
	});

	describe('#find', function() {

	});

	describe('#findById', function() {

	});

	describe('#create', function() {

		it('should create model', function() {

		});

	});

	describe('#update', function() {
		it('should update model', function() {

		});

		it('should update model without id', function() {

		});
	});

	describe('#delete', function() {

	});

});
