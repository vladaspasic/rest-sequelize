module.exports = function(sequelize, DataTypes) {
	var User = sequelize.define("User", {
		name: {
			type: DataTypes.STRING,
			allowNull: false
		},
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
