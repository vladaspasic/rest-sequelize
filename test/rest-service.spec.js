/* jshint undef: false */
var chai = require('chai'),
	database = require('./server').connect(),
	RestService = require('../lib/rest-service');

var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

var assert = chai.assert,
	expect = chai.expect;

var Service = new RestService(database.sequelize),
	User = database.models.User,
	Task = database.models.Task;

describe('RestService', function() {

	beforeEach(function(done) {
		database.sequelize.drop().then(function() {
			return database.sequelize.sync().then(function() {
				return User.bulkCreate([{
					name: 'Foo Bar',
					email: 'foo@bar.com'
				}, {
					name: 'Foo Bar 1',
					email: 'foo@bar.com'
				}, {
					name: 'Foo Bar 2',
					email: 'foo@bar.com'
				}]).then(function() {
					done();
				});
			});
		}, done);
	});

	describe('#find', function() {

		it('should find models', function(done) {
			var find = Service.find(User);

			assert.isFulfilled(find);
			expect(find).to.eventually.have.property("count", 3);
			expect(find).to.eventually.have.property("rows").notify(done);
		});

	});

	describe('#findOne', function() {

		it('should find first model', function(done) {
			var find = Service.findOne(User, {
				where: {id: 1}
			});

			assert.isFulfilled(find);
			expect(find).to.eventually.have.property("name", 'Foo Bar');
			expect(find).to.eventually.have.property("email", 'foo@bar.com').notify(done);
		});

		it('should find second model', function(done) {
			var find = Service.findOne(User, {
				where: {id: 2}
			});

			assert.isFulfilled(find);
			expect(find).to.eventually.have.property("name", 'Foo Bar 1');
			expect(find).to.eventually.have.property("email", 'foo@bar.com').notify(done);
		});

		it('should find third model', function(done) {
			var find = Service.findOne(User, {
				where: {id: 3}
			});

			assert.isFulfilled(find);
			expect(find).to.eventually.have.property("name", 'Foo Bar 2');
			expect(find).to.eventually.have.property("email", 'foo@bar.com').notify(done);
		});

		it('should be rejected', function(done) {
			var find = Service.findOne(User, {
				where: {id: 5}
			});

			assert.isRejected(find).notify(done);
		});

	});

	describe('#delete', function() {

		it('should delete model', function(done) {
			var promise = Service.persist(User, {
				name: 'to be deleted'
			}).then(function(user) {
				return Service.delete(User, user.id);
			});

			assert.isFulfilled(promise).notify(done);
		});

		it('should be rejected', function(done) {
			var find = Service.delete(User, {
				where: {id: 10}
			});

			assert.isRejected(find).notify(done);
		});

	});

	describe('#deleteAll', function() {

		it('should delete all models with a query', function(done) {
			User.bulkCreate([{
				name: 'to be deleted'
			}, {
				name: 'to be deleted'
			}, {
				name: 'to be deleted'
			}]).then(function() {
				return Service.deleteAll(User, {
					where: {
						name: 'to be deleted'
					}
				}).then(function(rows) {
					User.findAll({
						where: {
							name: 'to be deleted'
						}
					}).then(function(users) {
						assert.strictEqual(rows, 3, '3 Records should be deleted.');
						expect(users).to.be.empty;
						done();
					});
				});
			}, done);
		});

		it('should be fulfilled with 0 rows affected', function(done) {
			Service.deleteAll(User, {
				where: {id: 100}
			}).then(function(rows) {
				assert.strictEqual(rows, 0, '0 Records should be deleted.');
				done();
			}, done);
		});

	});

	describe('#persist', function() {

		it('should persist new model', function(done) {
			var promise = Service.persist(User, {
				name: 'New Foo'
			});

			expect(promise).to.eventually.have.property("name", 'New Foo').notify(done);
		});

		it('should persist new model with `hasMany` relation', function(done) {
			var promise = Service.persist(User, {
				name: 'New Foo',
				Tasks: [{
					name: 'Task'
				}]
			});

			assert.isFulfilled(promise);
			expect(promise).to.eventually.have.property("name", 'New Foo');
			expect(promise).to.eventually.have.deep.property("Tasks[0].name", 'Taskssss');
			expect(promise).to.eventually.have.property("id", 4).notify(done);
		});

		it('should persist new model with `belongsTo` relation', function(done) {
			var promise = Service.persist(Task, {
				name: 'New Task',
				User: {
					name: 'New User'
				}
			});

			assert.isFulfilled(promise);
			expect(promise).to.eventually.have.property("name", 'New Task');
			expect(promise).to.eventually.have.deep.property("User[0].name", 'New User');
			expect(promise).to.eventually.have.property("id", 1).notify(done);
		});

		it('should reject as the related model does not exist', function() {
			var promise = Service.persist(User, {
				name: 'New User',
				Tasks: [5]
			});

			return assert.isRejected(promise);
		});

	});

	describe('#populate', function() {

		it('should find Task association', function() {
			var query = {};
			Service.populate(database.models.User, query);

			assert.lengthOf(query.include, 1, 'Should contain one association');
			expect(query.include[0]).to.have.deep.property('as', 'Tasks');
			expect(query.include[0]).to.have.deep.property('model', database.models.Task);
		});

		it('should find User association', function() {
			var query = {};
			Service.populate(database.models.Task, query);

			assert.lengthOf(query.include, 1, 'Should contain one association');
			expect(query.include[0]).to.have.deep.property('as', 'User');
			expect(query.include[0]).to.have.deep.property('model', database.models.User);
		});

		it('should find no associations', function() {
			var query = {};
			Service.populate(database.models.Foo, query);

			assert.lengthOf(query.include, 0, 'Should contain no associations');
		});

	});

	describe('#resolveAssociationHandler', function() {

		it('should resolve create handler', function() {
			var handler = Service.resolveAssociationHandler('User');

			assert.typeOf(handler, 'function', 'Should be a function');
		});

		it('should resolve update handler', function() {
			var handler = Service.resolveAssociationHandler('User', 1);

			assert.typeOf(handler, 'function', 'Should be a function');
		});

		it('should throw unknown handler', function() {
			assert.throws(function() {
				var MyService = RestService.extend({
					createAssociation: 'bar'
				});

				var service = new MyService(database.sequelize);

				service.resolveAssociationHandler('Bar');
			}, 'Can not find Association Handler for keys `[createBarAssociation, createAssociation]`.');
		});

	});



	// Delete the database file, just in case :)
	after(function(done) {
		require('fs').unlink(__dirname + '/database.sqlite', function(error) {
			if (error) {
				console.error('Could not delete database.sqlite file', error);
			} else {
				console.error('Deleted database.sqlite file');
			}

			return done(error);
		});
	});

});
