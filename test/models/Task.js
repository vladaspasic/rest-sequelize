module.exports = function(sequelize, DataTypes) {
	var Task = sequelize.define("Task", {
		name: DataTypes.STRING,
		type: DataTypes.STRING
	}, {
		classMethods: {
			associate: function(models) {
				return Task.belongsTo(models.User);
			}
		}
	});

	return Task;
};
