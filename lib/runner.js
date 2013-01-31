
/**
 * Module dependencies.
 */
var domain = require('domain')
  , http = require('http')
  , uuid = require('node-uuid')
  , port = process.env.PORT || 3000
  , timeout = process.env.SOCKET_TIMEOUT || 3000
  , cluster
  , isWorker = false;

try {
  cluster = require("cluster");
  isWorker = cluster.isWorker;
}
catch (e) {
  // Do nothing; we don't have cluster
}

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
    if (!process.env.NODE_DEV) {
      console.error(err.stack || err);
      process.exit(1);
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

    server.listen(port, function() {
      console.log("Server listening on port " + port + (isWorker?" ("+cluster.worker.id+")":""));
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

  if (handler.errorHandler) {
    onError = handler.errorHandler;
  }
  else if (handler.stack && handler.stack.errorHandler) {
    onError = handler.stack.errorHandler;
  }
  else {
    onError = function(err, req, res) {
      res.end('A fatal error occured:\n'+(process.env.NODE_ENV=="development"?err.stack:""));
    };
  }

  return function(req, res, reqd) {
    return function(err) {
      console.error(err.stack || err);
      try {
        res.writeHead(500);
        res.on('close', function() {
          reqd.dispose();
        });

        onError(err, req, res);

      } catch (err) {
        console.error('Error sending 500', err.stack || err, req.url);
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