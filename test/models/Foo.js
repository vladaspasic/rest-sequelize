module.exports = function(sequelize, DataTypes) {
	return sequelize.define("Foo", {
		name: DataTypes.STRING
	});
};
