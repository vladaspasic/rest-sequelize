/* jshint undef: false */
var chai = require('chai'),
	database = require('./server').connect(),
	Resolver = require('../lib/resolver'),
	RestService = require('../lib/rest-service')
	Serializer = require('../lib/serializer')
	Deserializer = require('../lib/rest-service');

var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

var assert = chai.assert,
	expect = chai.expect;

