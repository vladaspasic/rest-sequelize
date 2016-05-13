/* globals describe, it, before, after, afterEach */
"use strict";

const chai = require('chai');
const keys = require('when/keys');
const request = require('supertest');
const server = require('./server').createServer();
const assert = chai.assert;
const expect = chai.expect;

// Create a User record
function createUser() {
	return server.sequelize.models.User.create({
		name: 'Foo Bar',
		email: 'foo@bar.com'
	});
}
// Create a Task with user
function createTask(user) {
	const id = user ? user.get('id') : null;

	return server.models.Task.create({
		name: 'SubTask',
		UserId: id
	});
}

// Clear the DB
function clear(done) {
	return keys.all({
		users: server.sequelize.models.User.destroy({
			where: {}
		}),
		tasks: server.sequelize.models.Task.destroy({
			where: {}
		})
	}).then(function() {
		done();
	}, done);
}

describe('REST', function() {

	before(function(done) {
		server.sequelize.drop().then(function() {
			return server.sequelize.sync({
				force: true
			}).then(function() {
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
			clear(done);
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

		it('should not create model with an unsaved association', function(done) {
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

					assert.lengthOf(result.Tasks, 0, 'Should have 0 Tasks');
				})
				.end(done);
		});

		it('should create model with existing association as an object', function(done) {
			
			createTask().then((task) => {
				request(server.app)
					.post('/users')
					.send({
						name: 'Foo Bar 2',
						email: 'foo2@bar.com',
						Tasks: [{
							id: task.get('id')
						}]
					})
					.expect(201)
					.expect(function(res) {
						expect(res.body).to.have.property('result');
						expect(res.body).to.have.property('meta');

						expect(res.body.result).to.have.property('name', 'Foo Bar 2');
						expect(res.body.result).to.have.property('email', 'foo2@bar.com');
						assert.lengthOf(res.body.result.Tasks, 1, 'Should have 1 Task');
						expect(res.body.result.Tasks[0]).to.have.property('id', task.get('id'));

					}).end(done);
			});
		});

		it('should create a new Task with association', function(done) {
			createUser().then((user) => {
				request(server.app)
					.post('/tasks')
					.send({
						name: 'New Task',
						User: user.toJSON()
					})
					.expect(201)
					.expect(function(res) {
						expect(res.body).to.have.property('result');
						expect(res.body).to.have.property('meta');

						expect(res.body.result).to.have.property('name', 'New Task');
						expect(res.body.result.User).to.have.property('name', user.get('name'));
						expect(res.body.result.User).to.have.property('email', user.get('email'));
					})
					.end(done);
			}).catch(done);
		});

		it('should throw bad request', function(done) {
			request(server.app)
				.post('/users')
				.expect(400)
				.end(done);
		});

		after(function(done) {
			clear(done);
		});
	});

	describe('#findSubResource', function() {

		it('should fetch subResource', function(done) {
			createUser().then((user) => {
				return createTask(user).then((task) => {
					request(server.app)
						.get('/users/' + user.get('id') + '/tasks')
						.expect(200)
						.expect(function(res) {
							expect(res.body).to.have.property('result');
							expect(res.body).to.have.property('meta');

							assert.lengthOf(res.body.result, 1, 'Should have 1 Task');
							expect(res.body.result[0]).to.have.property('id', task.get('id'));
							expect(res.body.result[0]).to.have.property('name', task.get('name'));
						}).end(done);
				});
			}).catch(done);

		});

		it('should fetch one subResource', function(done) {
			createUser().then((user) => {
				return createTask(user).then((task) => {
					request(server.app)
						.get('/users/' + user.get('id') + '/tasks/' + task.get('id'))
						.expect(200)
						.expect(function(res) {
							expect(res.body).to.have.property('result');
							expect(res.body).to.have.property('meta');

							expect(res.body.result).to.have.property('id', task.get('id'));
							expect(res.body.result).to.have.property('name', task.get('name'));
						}).end(done);
				});
			}).catch(done);
		});

		after(function(done) {
			clear(done);
		});

	});

	describe('#createSubResources', function() {

		it('should create subResources', function(done) {

			createUser().then((user) => {
				request(server.app)
					.put('/users/' + user.get('id') + '/tasks')
					.send([{
						name: 'Foo Bar Foo Task'
					}, {
						name: 'Foo Bar Foo Task Task'
					}])
					.expect(200)
					.expect(function(res) {
						expect(res.body.result).to.have.length(2);
						
						expect(res.body.result[0]).to.have.property('name', 'Foo Bar Foo Task');
						expect(res.body.result[1]).to.have.property('name', 'Foo Bar Foo Task Task');
					})
					.end(done);
			}).catch(done);
		});

		after(function(done) {
			clear(done);
		});
	});

	describe('#deleteSubResources', function() {

		it('should delete subResource with query params', function(done) {
			createUser().then((user) => {
				return createTask(user).then((task) => {
					request(server.app)
						.del('/users/' + user.get('id') +  '/tasks/?id=' + task.get('id'))
						.expect(200)
						.expect(function(res) {
							assert.deepEqual(res.body, 1);
						})
						.end(done);
				});
			}).catch(done);

			
		});

		it('should delete subResource with id', function(done) {
			createUser().then((user) => {
				return createTask(user).then((task) => {
					request(server.app)
						.del('/users/' + user.get('id') +  '/tasks/' + task.get('id'))
						.expect(200)
						.expect(function(res) {
							assert.deepEqual(res.body, 1);
						})
						.end(done);
				});
			}).catch(done);
		});

		after(function(done) {
			clear(done);
		});
	});

	describe('#update', function() {
		it('should update model', function(done) {
			createUser().then((user) => {
				request(server.app)
				.put('/users/' + user.get('id'))
				.send({
					name: 'Foo Bar Foo'
				})
				.expect(200)
				.expect(function(res) {
					expect(res.body).to.have.property('result');
					expect(res.body).to.have.property('meta');

					expect(res.body.result).to.have.property('id', user.get('id'));
					expect(res.body.result).to.have.property('name', 'Foo Bar Foo');
				})
				.end(done);
			}).catch(done);
		});

		it('should update model with an existing updated association', function(done) {
			createUser().then((user) => {
				return createTask(user).then((task) => {
					request(server.app)
						.put('/users/' + user.get('id'))
						.send({
							name: 'Foo Bar Foo',
							Tasks: [{
								id: task.get('id'),
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
							// should not update sub record props
							expect(result.Tasks[0]).to.have.property('name', task.get('name'));
						})
						.end(done);
				});
			}).catch(done);
		});

		it('should update model and ignore new associated record', function(done) {
			createUser().then((user) => {
				return createTask(user).then((task) => {
					request(server.app)
						.put('/users/' + user.get('id'))
						.send({
							name: 'Foo Bar Foo',
							Tasks: [{
								name: 'Foo\'s new Task'
							}, task.toJSON() ]
						})
						.expect(200)
						.expect(function(res) {
							expect(res.body).to.have.property('result');
							expect(res.body).to.have.property('meta');

							var result = res.body.result;

							expect(result).to.have.property('name', 'Foo Bar Foo');
							expect(result).to.have.property('email', 'foo@bar.com');

							assert.lengthOf(result.Tasks, 1, 'Should have 1 Task');
							expect(result.Tasks[0]).to.have.property('id', task.get('id'));
							expect(result.Tasks[0]).to.have.property('name', task.get('name'));
						})
						.end(done);
				});
			}).catch(done);
		});

		it('should throw model not found', function(done) {
			request(server.app)
				.put('/users/10')
				.send({
					name: 'Foo Bar Foo'
				})
				.expect(404)
				.end(done);
		});

		after(function(done) {
			clear(done);
		});
	});

	describe('#delete', function() {

		before(function(done) {
			createUser().then(() => {
				done();
			}).catch(done);
		});

		it('should delete model', function(done) {
			request(server.app)
				.del('/users/1')
				.expect(204)
				.expect(function(res) {
					assert.deepEqual(res.body, {}, 'Response should be empty.');
				})
				.end(function() {
					server.sequelize.models.User.findById(1).then(function(user) {
						assert.isNull(user, 'User should be null');
						done();
					}, done);
				});
		});

		it('should throw model not found', function(done) {
			request(server.app)
				.del('/users/10')
				.expect(404)
				.end(done);
		});

		after(function(done) {
			clear(done);
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