
var domain = require('domain')
  , http = require('http');

module.exports = function(appPath) {

  var app = require(appPath)
    , port = process.env.PORT || 3000
    , serverDomain = domain.create();

  // Catch all unhandled exceptions for the server
  serverDomain.run(function() {
    var server = http.createServer(function(req, res) {
      // Make a domain for this request
      var reqd = domain.create();

      // Add req and res the the request domain
      reqd.add(req);
      reqd.add(res);

      // Error handler
      reqd.on('error', function(err) {
        console.error('Uncaught Exception', err.stack, req.url);
        try {
          res.writeHead(500);
          res.on('close', function() {
            reqd.dispose();
          });

          // The app has a custom error handler
          if (app.errorHandler) {
            app.errorHandler(err, req, res);
          }
          else {
            res.end('A fatal error occured:\n'+(process.env.NODE_ENV=="development"?err.stack:""));
          }
        } catch (err) {
          console.error('Error sending 500', err.stack, req.url);
          reqd.dispose();
        }
      });

      // Call our app handler in the req domain
      if (app instanceof http.Server) {
        // Express 2.x or Connect 1.x
        if (app.handle) {
          // Call it on the app so it can access `this.stack`
          reqd.bind(function(_req, _res) {app.handle(_req, _res)})(req, res);
        }
        // Raw HTTP Server
        else {
          reqd.bind(app._events.request)(req, res);
        }
      }
      // Express 3.x, Connect 2.x, or basic requestHandler
      else {
        reqd.bind(app)(req, res);
      };
    });

    // TODO do we need to transfer properties from `app` to `server`?

    // Start listening on our port
    server.listen(port, function() {
      console.log("Server listening on port " + port);
    });
  });

  return app;
};