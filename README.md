# rest-sequelize [![Build Status](https://img.shields.io/travis/vladaspasic/rest-sequelize.svg?branch=master)](https://travis-ci.org/vladaspasic/rest-sequelize) [![Coverage Status](https://img.shields.io/coveralls/vladaspasic/rest-sequelize.svg)](https://coveralls.io/r/vladaspasic/rest-sequelize)

Rest Sequelize library is built to provide you with a extendible REST interface that you can use.

###Installation

```bash
npm install rest-sequelize --save
```

###Introduction

This library exposes you a simple Namespace Object containg all the thing you would need. Let quickly through them:

* RestAdapter
* RestService
* Resolver
* Serializer
* Deserializer

All of these classes expose `create` and `extend` methods. It is advised that you instantiate all those classes with `RestAdapter.create()` instead `new RestAdapter()`.

In order to create subclasses use `RestAdapter.extend()` method. Keep in mind that if you override a method in the class, you can call its super implementation like so:

```javascript
var MyService = RestService.extend({
    init: function() {
        this._super();
    }
});
```

For full API docs visit ....

This library uses [error-globals](https://github.com/vladaspasic/error-globals) for Error handling, as we can get the `statusCode` property for each error thrown by the library to display an appropriate HTTP status code in the response.

#### Usage

To use this you must first create a `RestAdapter` instance, and pass a `sequelize` property to it. I will not go through how to create a Sequelize instance, you can read this [here](http://docs.sequelizejs.com/en/latest/docs/getting-started/).

```javascript
var RestSequelize = require('rest-sequelize');

var adapter = RestSequelize.RestAdapter.extend({
   sequelize: sequelize,// your initialized sequelized instance
});
```

Here we have created a simple `RestAdapter` instance with a `DefaultResolver`. If you wish to use a custom `Resolver` you must create your own. But we will come to that a bit later.

Lets asume that you have already created an sequelize instance, and defined a `User` model. To get a full list of users, you can do something like this.

```javascript
adapter.find('users').then(function(users) {
    console.log(users);
}, function(error) {
    // your error handling logic
});

// Or

adapter.find(sequelize.models.User).then(function(users) {
    console.log(users);
}, function(error) {
    // your error handling logic
});
```

Let us explain what is going under the hood step by step.

First we will try to resolve the the `Model` using the `modelFor` method in the `RestAdapter`, this method then asks the `Resolver` to find it/resolve it. Resolver then tries to see if a model with a plural name for `users` exists in the the sequelize instance. Or in the second case the Model would be returned as it is already there.

When a model is resolved, we are trying to find a corresponding `RestService` for `users`. In this case there is none as we are using the `DefaultResolver`
to find all modules, so a default `RestService` will be returned.

The `RestService` class is where all the communication with the DB occurs. The default one would be sufficent in most cases, but you can always create your own.
Here you could add your custom logic that can be run against the Sequelize ORM.

The service will return a model with all his associatations populated, and a count property. The adapter will create a default paging query with `page` property `1` and `size` `30` and default `sort` `updated_at` and `order` `DESC`.

You can page a resource like this.

```javascript
adapter.find('users', {
    page: 2,
    size: 15,
    sort: 'username',
    order: 'asc'
}).then(function(users) {
    console.log(users);
});
```

When a `RestService` finds the models, we are returning to the `RestAdapter` which will then try to find a `Serializer` to serialize the your results to a simple JSON object ready to be flushed to the client.

Let us now create a new User.

```javascript
adapter.create('users',{
    username: 'username',
    password: 'pass'
}).then(function(user) {
    console.log(user);
}, function(error) {
    // your error handling logic
});
```

Again we will try to resolve the model, but now we are going to see if there is a matching `Deserializer` which will try to deserialize the payload from the method. Deserializer can be usefull if you have wish to add some default values or manipulate them, or some of the keys are differently defined in the Model schema and in your Rest interface.

Afterwards we resolve a `RestService` that will actually create the Model instance and persist in the DB. The result is the again serialized using the matching `Serializer`.

We have now create a new User, lets see if can find him.

```javascript
adapter.findById('users', 1).then(function(user) {
    console.log(user);
});
```
And update it.

```javascript
adapter.update('users', 1, {
    username: 'new username'
}).then(function(user) {
    console.log(user);
});

// or

adapter.update('users', {
    id: 1,
    username: 'new username'
}).then(function(user) {
    console.log(user);
});
```

Mainly the same happens here as well, resolving `Model` -> `Deserializer` -> `RestService` -> `Serializer`. But inside the Service where are trying to see if the model with that ID exists and update it.

And we can delete it

```javascript
adapter.delete('users', 1).then(function(user) {
    console.log(user);
});
```

#### Resolver

As you could see the `Resolver` is one powerfull tool here as we can resolve to different implementations of the `Service`, `Serializer`, `Deserializer` and `Model` depending on the `name` and `type`.

To create your custom resolver you must implement the `resolve` method. Where type can be `services`, `models`, `serializers` or `deserializers`. Maybe you wish to add more types to your Rest interface that could be used by the Adapter.

```javascript
var RestSequelize = require('rest-sequelize');

var MyResolver = RestSequelize.Resolver.extend({
    resolve: function(type, name) {
        // Your logic
    }
});
```

And we can now add it the `RestAdapter`. Please make sure that you do not pass a
instance as the resolver is created by the `RestAdapter` which will then pass the `sequelize` property to it.

```javascript
var adapter = RestSequelize.RestAdapter.extend({
   sequelize: sequelize,
   Resolver: MyResolver
});
```

