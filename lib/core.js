var _ = require('lodash');

/**
 * Base Object Class for all classes inside the Rest Sequelize Registry.
 *
 * @class Object
 * @namespace RestSequelize
 */
var CoreObject = function() {

};

function extend(protoProps, staticProps) {
	var parent = this;
	var child, hasFunction = false;

	if (protoProps && _.has(protoProps, 'constructor')) {
		child = protoProps.constructor;
	} else {
		child = function(){
			if(this.init) {
				this.init.apply(this, arguments);
			} else {
				parent.apply(this, arguments);
			}
		};
	}

	_.extend(child, parent);

	var Class = function() {
		this.constructor = child;
	};

	Class.prototype = parent.prototype;
	child.prototype = new Class();

	if (protoProps) {
		_.each(protoProps, function(value, key) {

			if ('function' !== typeof value) {
				protoProps[key] = value;
			} else {
				hasFunction = true;
				protoProps[key] = giveMethodSuper(child.prototype, key, value, parent.prototype);
			}

		});

		_.extend(child.prototype, protoProps);
	}

	_.each(staticProps || {}, function(prop, key) {
		Object.defineProperty(child.prototype, key, {
			value: prop,
			writable: false,
			configurable: false,
			enumerable: false
		});
	});

	child.toString = function() {
		return '(subclass of ' + parent.toString() + ')';
	};

	if (hasFunction) {
		child.prototype._super = superFunction;
	}

	child.__super__ = parent.prototype;

	return child;
}

/**
 * Extends the current class with an new subclass.
 *
 * @example
		var MyClass = RestSequelize.Object.extend({
			method: function(arg) {
				console.log(arg);
			}
		});
 *
 * When defining a subclass, you can override methods but
 * still access the implementation of your parent class by
 * calling the special _super() method:
 *
 * @example
 		var MyOtherClass = MyClass.extend({
			init: function() {
				this._super('New argument');
			}
		});
 *
 * @static
 * @method extend
 * @param {Object} props Object of new methods
 * @return {Object} a new subclass
 */
CoreObject.extend = extend;


function giveMethodSuper(obj, key, method, proto) {
	var superMethod = proto[key] || obj[key];

	if ('function' !== typeof superMethod) {
		return method;
	}

	return wrap(method, superMethod);
}

function wrap(func, superFunc) {
	function superWrapper() {
		var ret, sup = this && this.__nextSuper;

		if(this) {
			this.__nextSuper = superFunc;
		}

		ret = func.apply(this, arguments);

		if(this) {
			this.__nextSuper = sup;
		}

		return ret;
	}

	return superWrapper;
}

function superFunction() {
	var ret, func = this.__nextSuper;
	if (func) {
		this.__nextSuper = null;
		ret = func.apply(this, arguments);
		this.__nextSuper = func;
	}

	return ret;
}

/**
 * Initializer function for each class,
 * invoked by the all subclasses when they are
 * created / instantiated.
 *
 * @method init
 */
CoreObject.prototype.init = function() {

};

/**
 * Creates a new instance of the class.
 *
 * @example
 	var instance = RestSequelize.Object.create({
		method: function(arg) {
				console.log(arg);
			}
		});

	instance.method('My object');
 *
 * @method create
 * @static
 * @param {Object}    props   Defines new properties on the newly created object
 * @param {Object}    statics Defines read only values for the object
 * @return {Function} a new Object Class function
 */
CoreObject.create = function create(props, statics) {
	var C = this.extend(props, statics);

	return new C();
};

/**
 * Extends the class prototype
 *
 * @method reopen
 * @static
 * @param {Object} protoProps new properties for the prototype
 */
CoreObject.reopen = function reopen(protoProps) {
	_.extend(this.prototype, protoProps);
};

module.exports = CoreObject;
