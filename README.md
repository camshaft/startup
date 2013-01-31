startup
=======

Node.js HTTP app runner

Features
--------

* [Port Binding](#port-binding)
* [Hot-Reloading](#hot-reload)
* [Domains](#domains)
* [Cluster](#cluster)

Usage
-----

All startup requires is an exported http app:

### Express Example
```js
var express = require("express");

// Export the express app
var app = module.exports = express();

app.get("/", function (req, res){
  res.send("Hello!");
});
```

### Connect Example
```js
var connect = require("connect");

// Export the connect app
var app = module.exports = connect();

app.use(function (req, res, next){
  res.send("Hello!");
});
```

### Vanilla HTTP Example
```js
var http = require("http");

// Create the http server
var server = http.createServer(function (req, res){
  response.writeHead(200, {"Content-Type": "text/plain"});
  response.end("Hello!");
});

// Export it
module.exports = server;
```

To start the app, just run:

```sh
startup start
```

and startup will bind to the `PORT` environment variable.

Commands
--------

###`startup start`

Starts app listening on the `PORT` environment variable.

###`startup middleware`

Lists loaded middleware (express and connect only) without running the app.

###`startup routes`

Lists loaded middleware (express only) without running the app.

###`startup settings`

Lists app settings (express only) without running the app.

Port Binding
------------

`startup` will look for the `PORT` environment variable and try to bind to it. If not value is found, it defaults to `3000`. You can also set it by executing `startup start -P <port>`.

Hot-Reload
----------

To enable hot-reload, set the `NODE_ENV` environment variable to `development`. You may also specify --dev to force it.

Read more about [node-dev](https://github.com/fgnass/node-dev), the tool `startup` uses.

Domains
-------

[Domains](http://nodejs.org/api/domain.html) were introducted in `v0.8` and act as a way to isolate uncaught exceptions in a process. This proves useful for http servers when we want each request to be handled in a unique domain, as to not crash the whole server.

Setting it up requires a bit of boilerplate code that comes built in to `startup`.

You can also provide a custom error handler for when you do get an uncaught exception by exporting `errorHandler` in your app:

```js
var express = require("express");

// Export the express app
var app = module.exports = express();

app.get("/", function (req, res){
  res.send("Hello!")
});

module.exports.errorHandler = function (err, req, res) {
  res.send("There was an error!");
};
```

Cluster
-------

[Cluster](http://nodejs.org/api/cluster.html) allows a server to take advantage of all of the cores on a system instead of being limited by node's single thread. Executing `startup start --cluster` will enable cluster mode for all of the cpu's on the machine.
