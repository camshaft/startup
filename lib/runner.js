
var domain = require('domain')
  , http = require('http')
  , port = process.env.PORT || 3000;

module.exports = function(appPath) {
  var serverDomain = domain.create()
    , server;

  // Catch all unhandled exceptions for the server
  serverDomain.run(function() {
    var app = require(appPath),
        handler;

    // Call our app handler in the req domain
    if (app instanceof http.Server) {
      // Express 2.x or Connect 1.x
      if (app.handle) {
        // Call it on the app so it can access `this.stack`
        handler = function(req, res) {
          app.handle(req, res);
        };
      }
      // Raw HTTP Server
      else {
        handler = app._events.request;
      }
    }
    // Express 3.x, Connect 2.x, or basic requestHandler
    else if (typeof app === "function") {
      handler = app;
    }

    // We didn't get a supported handler
    if (!handler) {
      console.error("App is not a recognized HTTP server");
      serverDomain.dispose();
      process.exit(1);
    }

    server = http.createServer(function(req, res) {
      // Make a domain for this request
      var reqd = domain.create();

      // Add req and res the the request domain
      reqd.add(req);
      reqd.add(res);

      // Error handler
      reqd.on('error', function(err) {
        console.error('Uncaught Exception', err.stack || err, req.url);
        try {
          res.writeHead(500);
          res.on('close', function() {
            reqd.dispose();
          });

          // The handler has a custom error handler
          if (handler.errorHandler) {
            handler.errorHandler(err, req, res);
          }
          else if (handler.stack && handler.stack.errorHandler) {
            handler.stack.errorHandler(err, req, res);
          }
          else {
            res.end('A fatal error occured:\n'+(process.env.NODE_ENV=="development"?err.stack:""));
          }
        } catch (err) {
          console.error('Error sending 500', err.stack || err, req.url);
          reqd.dispose();
        }
      });

      reqd.bind(handler)(req, res);
    });

    // TODO do we need to transfer properties from `app` to `server`?

    // Start listening on our port
    server.listen(port, function() {
      console.log("Server listening on port " + port);
    });
  });

  return server;
};