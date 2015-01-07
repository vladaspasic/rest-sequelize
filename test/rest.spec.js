/* jshint undef: false */
var chai = require('chai'),
	request = require('supertest'),
	server = require('./server'),
	assert = chai.assert,
	expect = chai.expect;

describe('REST', function() {

	before(function(done) {
		server.sequelize.drop().then(function() {
			return server.sequelize.sync().then(function() {
				done();
			});
		}, done);
	});

	describe('#find', function() {
		it('should return an empty User list', function(done) {
			request(server.app).get('/users')
				.expect(200)
				.expect(function(res) {
					expect(res.body).to.have.property('result');
					expect(res.body).to.have.property('meta');

					assert.isArray(res.body.result, 'Result is not an Array');
					assert.lengthOf(res.body.result, 0, 'Result should be empty');


					expect(res.body).to.have.deep.property('meta.size', 0);
					expect(res.body).to.have.deep.property('meta.totalSize', 0);
					expect(res.body).to.have.deep.property('meta.page', 1);
					expect(res.body).to.have.deep.property('meta.totalPages', 0);
				})
				.end(done);
		});

		it('should return a Users list', function(done) {
			server.sequelize.models.User.bulkCreate([{
				name: 'Foo Bar',
				email: 'foo@bar.com'
			}, {
				name: 'Foo Bar 1',
				email: 'foo@bar.com'
			}, {
				name: 'Foo Bar 2',
				email: 'foo@bar.com'
			}]).then(function() {
				request(server.app).get('/users')
					.expect(200)
					.expect(function(res) {
						expect(res.body).to.have.property('result');
						expect(res.body).to.have.property('meta');

						assert.isArray(res.body.result, 'Result is not an Array');
						assert.lengthOf(res.body.result, 3, 'Result should contain 3 models');

						expect(res.body).to.have.deep.property('meta.size', 3);
						expect(res.body).to.have.deep.property('meta.totalSize', 3);
						expect(res.body).to.have.deep.property('meta.page', 1);
						expect(res.body).to.have.deep.property('meta.totalPages', 1);
					})
					.end(done);
			}, done);
		});

		it('should return a paginated Users list', function(done) {
			server.sequelize.models.User.bulkCreate([{
				name: 'Foo Bar',
				email: 'foo@bar.com'
			}, {
				name: 'Foo Bar 1',
				email: 'foo@bar.com'
			}, {
				name: 'Foo Bar 2',
				email: 'foo@bar.com'
			}]).then(function() {
				request(server.app).get('/users?page=1&size=1')
					.expect(200)
					.expect(function(res) {
						expect(res.body).to.have.property('result');
						expect(res.body).to.have.property('meta');

						assert.isArray(res.body.result, 'Result is not an Array');
						assert.lengthOf(res.body.result, 1, 'Result should contain 1 model');

						expect(res.body.result[0]).to.have.property('name', 'Foo Bar');
						expect(res.body.result[0]).to.have.property('email', 'foo@bar.com');

						expect(res.body).to.have.deep.property('meta.size', 1);
						expect(res.body).to.have.deep.property('meta.totalSize', 3);
						expect(res.body).to.have.deep.property('meta.page', 1);
						expect(res.body).to.have.deep.property('meta.totalPages', 3);
					})
					.end(done);
			}, done);
		});

		it('should return an ordered Users list', function(done) {
			server.sequelize.models.User.bulkCreate([{
				name: 'Foo Bar',
				email: 'foo@bar.com'
			}, {
				name: 'Foo Bar 1',
				email: 'foo@bar.com'
			}, {
				name: 'Foo Bar 2',
				email: 'foo@bar.com'
			}]).then(function() {
				request(server.app).get('/users?sort=name&order=DESC')
					.expect(200)
					.expect(function(res) {
						expect(res.body).to.have.property('result');
						expect(res.body).to.have.property('meta');

						assert.isArray(res.body.result, 'Result is not an Array');
						assert.lengthOf(res.body.result, 3, 'Result should contain 3 models');

						expect(res.body.result[0]).to.have.property('name', 'Foo Bar 2');
						expect(res.body.result[0]).to.have.property('email', 'foo@bar.com');

						expect(res.body).to.have.deep.property('meta.size', 3);
						expect(res.body).to.have.deep.property('meta.totalSize', 3);
						expect(res.body).to.have.deep.property('meta.page', 1);
						expect(res.body).to.have.deep.property('meta.totalPages', 1);
					})
					.end(done);
			}, done);
		});

		afterEach(function(done) {
			server.sequelize.models.User.destroy().then(function() {
				done();
			}, done);
		});
	});

	describe('#save', function() {
		it('should create model', function(done) {
			request(server.app)
				.post('/users')
				.send({
					name: 'Foo Bar',
					email: 'foo@bar.com'
				})
				.expect(201)
				.expect(function(res) {
					expect(res.body).to.have.property('result');
					expect(res.body).to.have.property('meta');

					expect(res.body.result).to.have.property('name', 'Foo Bar');
					expect(res.body.result).to.have.property('email', 'foo@bar.com');
				})
				.end(done);
		});

		it('should create model with association', function(done) {
			request(server.app)
				.post('/users')
				.send({
					name: 'Foo Bar',
					email: 'foo@bar.com',
					Tasks: [{
						name: 'Simple Task'
					}]
				})
				.expect(201)
				.expect(function(res) {
					expect(res.body).to.have.property('result');
					expect(res.body).to.have.property('meta');
					var result = res.body.result;

					expect(result).to.have.property('name', 'Foo Bar');
					expect(result).to.have.property('email', 'foo@bar.com');

					assert.lengthOf(result.Tasks, 1, 'Should have 1 Task');
					expect(result.Tasks[0]).to.have.property('name', 'Simple Task');
				})
				.end(done);
		});

		it('should create model with existing association as an object', function(done) {
			request(server.app)
				.post('/users')
				.send({
					name: 'Foo Bar 2',
					email: 'foo2@bar.com',
					Tasks: [{
						id: 1
					}]
				})
				.expect(201)
				.expect(function(res) {
					expect(res.body).to.have.property('result');
					expect(res.body).to.have.property('meta');

					expect(res.body.result).to.have.property('name', 'Foo Bar 2');
					expect(res.body.result).to.have.property('email', 'foo2@bar.com');
				})
				.end(done);
		});
	});

	describe('#update', function() {
		it('should update model', function(done) {
			request(server.app)
				.put('/users/1')
				.send({
					name: 'Foo Bar Foo'
				})
				.expect(200)
				.expect(function(res) {
					expect(res.body).to.have.property('result');
					expect(res.body).to.have.property('meta');

					expect(res.body.result).to.have.property('name', 'Foo Bar Foo');
					expect(res.body.result).to.have.property('email', 'foo@bar.com');
				})
				.end(done);
		});

		it('should update model with an existing updated association', function(done) {
			request(server.app)
				.put('/users/1')
				.send({
					name: 'Foo Bar Foo',
					Tasks: [{
						id: 1,
						name: 'Foo\'s Task'
					}]
				})
				.expect(200)
				.expect(function(res) {
					expect(res.body).to.have.property('result');
					expect(res.body).to.have.property('meta');

					var result = res.body.result;

					expect(result).to.have.property('name', 'Foo Bar Foo');
					expect(result).to.have.property('email', 'foo@bar.com');

					assert.lengthOf(result.Tasks, 1, 'Should have 1 Task');
					expect(result.Tasks[0]).to.have.property('name', 'Foo\'s Task');
				})
				.end(done);
		});

		it('should update model with a new association', function(done) {
			request(server.app)
				.put('/users/1')
				.send({
					name: 'Foo Bar Foo',
					email: 'Foo@Bar.com',
					Tasks: [{
						name: 'Foo\'s new Task'
					}]
				})
				.expect(200)
				.expect(function(res) {
					expect(res.body).to.have.property('result');
					expect(res.body).to.have.property('meta');

					var result = res.body.result;

					expect(result).to.have.property('name', 'Foo Bar Foo');
					expect(result).to.have.property('email', 'Foo@Bar.com');

					assert.lengthOf(result.Tasks, 2, 'Should have 1 Task');
					expect(result.Tasks[1]).to.have.property('name', 'Foo\'s new Task');
					expect(result.Tasks[0]).to.have.property('name', 'Foo\'s Task');
				})
				.end(done);
		});
	});

	describe('#delete', function() {
		it('should delete model', function(done) {
			request(server.app)
				.del('/users/1')
				.expect(204)
				.expect(function(res) {
					assert.deepEqual(res.body, {}, 'Response should be empty.');
				})
				.end(function() {
					server.sequelize.models.User.find(1).then(function(user) {
						assert.isNull(user, 'User should be null');
						done();
					}, done);
				});
		});
	});

	// Delete the database file, just in case :)
	after(function(done) {
		require('fs').unlink(__dirname + '/database.sqlite', function(error) {
			if(error) {
				console.error('Could not delete database.sqlite file', error);
			} else {
				console.error('Deleted database.sqlite file');
			}

			return done(error);
		});
	});

});
