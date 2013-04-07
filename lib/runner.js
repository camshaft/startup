/**
 * Module dependencies.
 */
var domain = require('domain')
  , http = require('http')
  , uuid = require('node-uuid')
  , cluster = require("cluster");

/**
 * Defines
 */
var TIMEOUT = process.env.SOCKET_TIMEOUT || 3000
  , PORT = process.env.PORT || 3000
  , IS_DEV = process.env.NODE_ENV === "development";

/**
 * noop
 */
function noop () {}

// Let the apps know they are running through startup(1)
process.env.STARTUP = true;

/** 
 * start app at path
 *
 * @param {String} appPath
 * @return {Server}
 * @api public
 */
module.exports = function start(appPath) {
  var app = require(appPath)
    , handler = chooseHandlerType(app)
    , onError = errorHandler(handler);

  var server = http.createServer(function(req, res) {
    // Make a domain for this request
    var reqd = domain.create();

    // Add req and res the the request domain
    reqd.add(req);
    reqd.add(res);

    // Error handler
    reqd.on('error', onError(req, res, reqd));

    // Dispose the domain
    res.on('close', function() {
      reqd.dispose();
    });

    reqd.bind(handler)(req, res);
  });

  // Forward the events from our root server to the app
  forwardEvents(server, handler);

  // Apply timeouts to the connections on server close
  applyTimeouts(server);

  // Let the app install any handlers (socket.io, sockjs, etc)
  server.emit("ready", server);

  server.listen(PORT, function() {
    console.log("Server listening on port " + PORT + (cluster.isWorker?" ("+cluster.worker.id+")":""));
    server.emit('listening', server);
  });

  return server;
};

/**
 * chooseHandlerType
 *
 * @api private
 */
function chooseHandlerType(app) {
  // Default emit to noop
  app.emit = app.emit || noop;

  // Call our app handler in the req domain
  if (app instanceof http.Server) {
    // Express 2.x or Connect 1.x
    if (app.handle) {
      // Call it on the app so it can access `this.stack`
      return function(req, res) {
        app.handle(req, res);
      };
    }
    // Raw HTTP Server
    else {
      return app._events.request;
    }
  }
  // Express 3.x, Connect 2.x, or basic requestHandler
  else if (typeof app === "function") {
    return app;
  }

  // We didn't get a supported handler
  if (!handler) {
    serverDomain.dispose();
    throw new Error("App is not a recognized HTTP server");
  }
};

/**
 * errorHandler
 *
 * @api private
 */
function errorHandler(handler) {

  var onError;
  
  if (handler.stack && handler.stack.length) {
    // Search for it in the middleware
    handler.stack.forEach(function(middleware){
      // We already found one
      if(onError) return;
      var handle = middleware.handle
        , route = middleware.route;
      // Error handlers have 4 args
      if(handle && handle.length === 4 && (route === "" || route === "/")) {
        onError = handle;
      }
    });
  }

  // Allow for override
  if (handler.errorHandler) {
    onError = handler.errorHandler;
  }

  // Default to generic handler
  if(!onError) {
    onError = function(err, req, res, next) {
      if(!IS_DEV) console.error(err.stack || err);
      res.writeHead(500);
      res.end((IS_DEV ? err.stack : "A fatal error occured"));
    };
  }

  return function(req, res, reqd) {
    return function(err) {
      try {
        // Try to send out the error
        onError(err, req, res, noop);
      } catch (handlerError) {
        console.error('Error sending 500', handlerError.stack || handlerError, req.url);
        reqd.dispose();
      }

      // Kill the process - errors put us in an unstable state
      process.kill(process.pid, 'SIGTERM');

      // Disconnect from the master to signal a restart
      cluster.worker.disconnect();
    };
  };
}

/**
 * forwardEvents
 * Forward events from our root server to our handler
 * 
 * @api private
 */
function forwardEvents(server, handler) {
  if (!handler.emit) return;

  var emit = server.emit;

  server.emit = function () {
    emit.apply(server, arguments);
    handler.emit.apply(handler, arguments);
  };
}

/**
 * applyTimeouts
 * Handle shutting down our connections gracefully
 * 
 * @api private
 */
function applyTimeouts(server) {
  server.openSockets = {};

  server.on("connection", function(socket) {
    socket.id = socket.id || uuid.v4();

    if (!server.openSockets[socket.id]) {
      server.openSockets[socket.id] = socket;

      socket.on('close', function() {
        delete server.openSockets[socket.id];
      });
    };
  });

  function closeConnections() {
    // We've already been called to shutdown
    if (server.closingConnections) return;

    server.closingConnections = true;
    for (var id in server.openSockets) {
      var socket = server.openSockets[id];
      socket.setTimeout(TIMEOUT, function() {
        socket.destroy();
      });
    }
  };

  process.once("SIGTERM", closeConnections);
  process.once("SIGINT", closeConnections);
};
