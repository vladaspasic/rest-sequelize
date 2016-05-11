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

All of these classes can be extended. For example you can create subclasses of `RestAdapter` like so:

```javascript
const RestSequelize = require('rest-sequelize');

class MyService extends RestSequelize.RestService {
    
    find() {
        // your logic here
    }

}
```

For full API docs visit this [link](http://vladaspasic.github.io/rest-sequelize/)

This library uses [error-globals](https://github.com/vladaspasic/error-globals) for Error handling, as we can get the `statusCode` property for each error thrown by the library to display an appropriate HTTP status code in the response.

#### Usage

To use this you must first create a `RestAdapter` instance, and pass a `sequelize` property to it. I will not go through how to create a Sequelize instance, you can read this [here](http://docs.sequelizejs.com/en/latest/docs/getting-started/).

```javascript
const RestSequelize = require('rest-sequelize');

// your initialized sequelized instance
const sequalize = new Sequelize();

const adapter = new RestSequelize.RestAdapter(sequelize);
```

Here we have created a simple `RestAdapter` instance with a `DefaultResolver`. If you wish to use a custom `Resolver` you must create your own. But we will come to that a bit later.

Lets asume that you have already created an sequelize instance, and defined a `User` model. To get a full list of users, you can do something like this.

```javascript
adapter.find('users').then((serialized) => {
    console.log(serialized);
}).catch((error) => {
    // your error handling logic
});

// Or

adapter.find(sequelize.models.User).then((serialized) => {
    console.log(serialized);
}, (error) => {
    // your error handling logic
});
```

Let us explain what is going under the hood step by step.

First we will try to resolve the the `Model` using the `modelFor` method in the `RestAdapter`, this method then asks the `Resolver` to find it/resolve it. Resolver then tries to see if a model with a plural name for `users` exists in the the sequelize instance. Or in the second case the Model would be returned as it is already there.

When a model is resolved, we are trying to find a corresponding `RestService` for `users`. In this case there is none, and as we are using a `DefaultResolver` to find all modules, a default `RestService` will be returned.

The `RestService` class is where all the communication with the DB occurs. The default one would be sufficent in most cases, but you can always create your own.
Here you could add your custom logic that can be run against the Sequelize ORM.

The service will return a model with all his associatations populated, and a count property. The adapter will create a default paging query with `page` property `1` and `size` `30` and default `sort` `updated_at` and `order` `DESC`.

You can page a resource like this.

```javascript
adapter.find('users', {
    username: 'foobar'
} {
    page: 2, // defaults to 1
    size: 15, // defaults to 30
    sort: 'username', // defaults to modified_at
    order: 'asc' // defaults to DESC
}).then((serialized) => {
    console.log(serialized);
});
```

When a `RestService` finds the models, `RestAdapter` will then try to find a `Serializer` to serialize the your results to a simple JSON object ready to be flushed to the client.

Let us now create a new User.

```javascript
adapter.create('users',{
    username: 'username',
    password: 'pass'
}).then((serialized) => {
    console.log(serialized);
}).catch((error) => {
    // your error handling logic
});
```

Again we will try to resolve the model, but now we are going to see if there is a matching `Deserializer` which will try to deserialize the payload from the method. Deserializers can be usefull if you need convert the incoming JSON payload to your internal schema specifications.

Afterwards we resolve a `RestService` that will actually create the Model instance and persist in the DB. The result is the again serialized using the matching `Serializer`.

We have now create a new User, lets see if can find him.

```javascript
adapter.findById('users', 1).then((user) => {
    console.log(user);
});
```
And update it.

```javascript
adapter.update('users', 1, {
    username: 'new username'
}).then((serialized) => {
    console.log(serialized);
});

// or

adapter.update('users', {
    id: 1,
    username: 'new username'
}).then((serialized) => {
    console.log(serialized);
});
```

We can now delete the create Model like so:

```javascript
adapter.delete('users', 1);
```

#### Resolver

As you could see the `Resolver` is one powerfull tool here as we can resolve to different implementations of the `Service`, `Serializer`, `Deserializer` and `Model` depending on the `name` and `type`.

To create your custom resolver you must implement the `resolve` method. Where type can be `services`, `models`, `serializers` or `deserializers`. Maybe you wish to add more types to your Rest interface that could be used by the Adapter.

In this example we are going to resolve modules using the require method. Here the `type` will be the folder name and `name` is the name of the file we wish to load. If the file is not present, we will return the default implementation.

```javascript
// resolver.js
const RestSequelize = require('rest-sequelize');

class MyResolver extends RestSequelize.Resolver {
    resolve(sequalize, type, name) {
        let Factory;

        try {
            Factory = require(`./${type}/${name}`);
        } catch(e) {
            Factory = this.getDefaultFactory(type, name);
        }

        return new Factory(sequelize);
    }

    getDefaultFactory(type, name) {
        switch(type) {
            case 'services': return RestSequelize.RestService;
            case 'serializers': return RestSequelize.Serializer;
            case 'deserializers': return RestSequelize.Deserializer;
            default:
                throw new Error(`Could not resolve Factory with type '${type}' and name ${name}`);
        }
    }
};

module.exports = MyResolver;
```

And we can now add it the `RestAdapter`.

```javascript
const RestSequelize = require('rest-sequelize');
const Resolver = require('./resolver');

// your initialized sequelized instance
const sequalize = new Sequelize();
const resolver = new Resolver();

const adapter = new RestSequelize.RestAdapter(sequelize, resolver);
```

