/**
 * Module dependencies.
 */

var domain = require('domain');
var http = require('http');
var uuid = require('node-uuid');
var cluster = require('cluster');
var resolve = require('path').resolve;
var toobusy = require('toobusy');
var envs = require('envs');

/**
 * Let the apps know they are running through startup(1)
 */

process.env.STARTUP = true;

/**
 * Defines
 */

var SOCKET_TIMEOUT = envs.int('SOCKET_TIMEOUT', 3000);
var SERVER_TIMEOUT = envs.int('SERVER_TIMEOUT', 3000);
var TOOBUSY_LAG = envs.int('TOOBUSY_LAG');
var PORT = envs.int('PORT', 3000);
var IS_DEV = envs('NODE_ENV') === 'development';
var WORKER = cluster.isWorker ? '(' + cluster.worker.id + ')' : '';

/**
 * noop
 */

function noop () {};

/**
 * Set the toobusy lag
 */

if (TOOBUSY_LAG) toobusy.maxLag(TOOBUSY_LAG);

/**
 * get the app path
 */

var path = resolve(process.cwd(), process.argv[3] || process.argv[2]);

/**
 * require the app
 */

var app = require(path);

/**
 * default app.emit to noop
 */

if (!app.emit) app.emit = noop;

/**
 * get the app handler
 */

var handler = chooseHandler(app);

/**
 * get the error handler for the app
 */

var onerror = chooseErrorHandler(app);

/**
 * create a server instance
 *
 * @todo allow for https or http
 */

var server = http.createServer(function(req, res) {
  // If we are too busy send an error
  if (TOOBUSY_LAG && toobusy()) {
    var err = new Error('Server too busy with a lag of ' + toobusy.lag() + 'ms');
    err.code = 503;
    err.toobusy = true;
    return onerror(req, res)(err);
  }

  // make a domain for this request
  var reqd = domain.create();

  // add req and res the the request domain
  reqd.add(req);
  reqd.add(res);

  // error handler
  reqd.on('error', onerror(req, res, reqd));

  // dispose the domain
  res.on('close', function() {
    reqd.dispose();
  });

  // execute the request against the handler
  reqd.bind(handler)(req, res);
});

/**
 * Forward the events from our root server to the app
 */

var emit = server.emit;

server.emit = function () {
  emit.apply(server, arguments);
  app.emit.apply(app, arguments);
};

/**
 * Track the open connections
 */

server.openSockets = {};

server.on('connection', function(socket) {
  socket.id = socket.id || uuid.v4();

  if (!server.openSockets[socket.id]) {
    server.openSockets[socket.id] = socket;

    socket.on('close', function() {
      delete server.openSockets[socket.id];
    });
  };
});

/**
 * Let the app install any handlers (socket.io, sockjs, etc)
 */

server.emit('ready', server);

/**
 * Listen on the passed port
 */

server.listen(PORT, function() {
  console.log('Server listening on port', PORT, WORKER);
  server.emit('listening', server);
});

/**
 * choose an app handler
 *
 * @param {HTTPServer|Function} app
 * @return {Function}
 * @api private
 */

function chooseHandler(app) {
  // Call our app handler in the req domain
  if (app instanceof http.Server) {

    // Express 2.x or Connect 1.x
    if (app.handle) return function(req, res) {
      app.handle(req, res);
    };

    // Raw HTTP Server
    return app._events.request;
  }

  // Express 3.x, Connect 2.x, or basic requestHandler
  if (typeof app === 'function') return app;

  // We didn't get a supported handler
  throw new Error(app.toString() + ' is not a recognized HTTP server');
};

/**
 * errorHandler
 *
 * @api private
 */

function chooseErrorHandler(handler) {

  var errorHandler;

  // Use the exposed error handler on the app
  if (handler.errorHandler) errorHandler = handler.errorHandler;
  
  // Search for a error handler in the middleware
  if (!errorHandler && handler.stack && handler.stack.length) {
    handler.stack.forEach(function(middleware){
      // We already found one
      if (errorHandler) return;

      var handle = middleware.handle
      var route = middleware.route;

      // Error handlers have 4 args
      if (handle && handle.length === 4 && (route === '' || route === '/')) errorHandler = handle;
    });
  }

  // Default to generic handler
  if (!errorHandler) {
    errorHandler = function(err, req, res, next) {
      console.error(err.stack || err);
      res.writeHead(500);
      res.end((IS_DEV ? err.stack : err));
    };
  }

  return function(req, res, reqd) {

    // Save a reference to the shutdown timeout
    var killTimer;

    return function(err) {
      try {
        // Try to send out the error
        errorHandler(err, req, res, noop);
      } catch (handlerError) {
        if (reqd) reqd.dispose();
      }

      // If we aren't in the domain so don't shut down our worker
      // If we're not in cluster mode so don't shut down
      // We're already shutting down the worker
      if (!reqd || !cluster.isWorker || killTimer) return;

      killTimer = setTimeout(function() {
        // Kill the process - unhandled exceptions put us in an unstable state
        process.kill(process.pid, 'SIGTERM');

        // Disconnect from the master to signal a restart
        cluster.worker.disconnect();
      }, SERVER_TIMEOUT);

      // Don't let our timer hold up the shutdown
      if (killTimer.unref) killTimer.unref();
    };
  };
}

/**
 * Handle process signals
 */

process.once('SIGTERM', handleClose);
process.once('SIGINT', handleClose);

function handleClose() {
  // If the server is already shutting down, don't do anything
  if (server.shuttingDown) return;

  // Mark the server as shutting down
  server.shuttingDown = true;

  console.log('Shutting down server', WORKER);

  // If the server doesn't stop listening in time, we just exit
  // This is usually caused by an overwhelming number or requests
  var serverTimeout = setTimeout(function() {
    process.exit(1);
  }, SERVER_TIMEOUT);

  // Apply a timeout to all of the open sockets
  for (var id in server.openSockets) {
    var socket = server.openSockets[id];
    socket.setTimeout(SOCKET_TIMEOUT, function() {
      socket.destroy();
    });
  }

  // Shut down the server
  try {
    server.close(function() {
      clearTimeout(serverTimeout);
      toobusy.shutdown();
    });
  }
  catch (e) {
    // The server was already closed
  }
};
