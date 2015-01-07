var models = ['Task', 'User'];

module.exports = function(sequelize) {
	var Models = {};

	models.forEach(function(name) {
		Models[name] = sequelize.import(__dirname + '/' + name);
	});

	models.forEach(function(name) {
		var Model = Models[name];

		Model.associate(Models);
	});

	return Models;
};
