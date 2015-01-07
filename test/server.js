var Sequelize = require('sequelize'),
	express = require('express'),
	parser = require('body-parser'),
	models = require('./models'),
	rest = require('..');

var sequelize = new Sequelize('database', 'user', 'pass', {
	dialect: 'sqlite',
	storage: __dirname + '/database.sqlite'
});

var Models = models(sequelize);

var app = express();

app.use(parser.json());

var Adapter = rest(sequelize);

app.get('/users', function(req, res, next) {
	Adapter.find('users', req.query).then(function(users) {
		return res.json(users);
	}, next);
});

app.post('/users', function(req, res, next) {
	Adapter.create('users', req.body).then(function(user) {
		return res.status(201).json(user);
	}, next);
});

app.post('/tasks', function(req, res, next) {
	Adapter.create('tasks', req.body).then(function(task) {
		return res.status(201).json(task);
	}, next);
});

app.put('/users/:id', function(req, res, next) {
	Adapter.update('users', req.params.id, req.body).then(function(user) {
		return res.json(user);
	}, next);
});

app.delete('/users/:id', function(req, res, next) {
	Adapter.delete('users', req.params.id).then(function() {
		return res.status(204).send();
	}, next);
});

app.use(function(error, req, res, next) {
	console.log(error.stackTrace());

	return res.status(error.statusCode || 500).json(error);
});

module.exports.Sequelize = Sequelize;
module.exports.sequelize = sequelize;
module.exports.app = app;
