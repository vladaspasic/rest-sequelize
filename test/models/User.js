module.exports = function(sequelize, DataTypes) {
	var User = sequelize.define("User", {
		name: DataTypes.STRING,
		email: DataTypes.STRING
	}, {
		classMethods: {
			associate: function(models) {
				return User.hasMany(models.Task);
			}
		}
	});

	return User;
};
