/**
 * Module dependencies.
 */
var domain = require('domain')
  , http = require('http')
  , uuid = require('node-uuid')
  , port = process.env.PORT || 3000
  , timeout = process.env.SOCKET_TIMEOUT || 3000
  , noop = function(){}
  , isWorker = false
  , cluster;

try {
  cluster = require("cluster");
  isWorker = cluster.isWorker;
}
catch (e) {
  // Do nothing; we don't have cluster
}

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
  var serverDomain = domain.create()
    , server;

  serverDomain.on("error", function(err) {
    if (!process.env.NODE_DEV || err.code === "EADDRINUSE") {
      console.error(err.stack || err);
      process.kill(process.pid, "SIGTERM");
    }
  });

  // Catch all unhandled exceptions for the server
  serverDomain.run(function() {
    var app = require(appPath)
      , handler = chooseHandlerType(app)
      , onError = errorHandler(handler);

    server = http.createServer(function(req, res) {
      // Make a domain for this request
      var reqd = domain.create();

      // Add req and res the the request domain
      reqd.add(req);
      reqd.add(res);

      // Error handler
      reqd.on('error', onError(req, res, reqd));

      reqd.bind(handler)(req, res);
    });

    applyEvents(server, handler);
    applyTimeouts(server);
    // Let the app install any handlers (socket.io, sockjs, etc)
    app.emit("ready", server);

    server.listen(port, function() {
      console.log("Server listening on port " + port + (isWorker?" ("+cluster.worker.id+")":""));
      app.emit('listening', server);
    });
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

  var onError
    , isDev = process.env.NODE_ENV=="development";
  
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
      if(!isDev) console.error(err.stack || err);
      res.writeHead(500);
      res.end((isDev ? err.stack : "A fatal error occured"));
    };
  }

  return function(req, res, reqd) {
    return function(err) {
      try {
        res.on('close', function() {
          reqd.dispose();
        });

        onError(err, req, res, noop);

      } catch (handlerError) {
        console.error('Error sending 500', handlerError.stack || handlerError, req.url);
        reqd.dispose();
      }
    };
  };
}

/**
 * applyEvents
 * Forward events from our root server to our handler
 * 
 * @api private
 */
function applyEvents(server, handler) {

  function partial(event) {
    return function() {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(event);
      handler.emit.apply(handler, args);
    };
  };

  if (handler.emit) {
    ["request",
     "connection",
     "close",
     "checkContinue",
     "connect",
     "upgrade",
     "clientError"]
      .forEach(function(event) {
        server.on(event, partial(event));
      });
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
      socket.setTimeout(timeout, function() {
        socket.destroy();
      });
    }
  };

  process.once("SIGTERM", closeConnections);
  process.once("SIGINT", closeConnections);
};
