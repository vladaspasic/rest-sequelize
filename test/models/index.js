var models = ['Task', 'User', "Foo"];

module.exports = function(sequelize) {
	var Models = {};

	models.forEach(function(name) {
		Models[name] = sequelize.import(__dirname + '/' + name);
	});

	models.forEach(function(name) {
		var Model = Models[name];

		if(typeof Model.associate === 'function') {
			Model.associate(Models);
		}
	});

	return Models;
};
