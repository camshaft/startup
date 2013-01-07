
var domain = require('domain')
  , http = require('http');

module.exports = function(path) {

  var app = require(path)
    , port = process.env.PORT || 3000;

  var serverDomain = domain.create();

  serverDomain.run(function() {
    http.createServer(function(req, res) {
      var reqd = domain.create();
      reqd.add(req);
      reqd.add(res);
      reqd.on('error', function(err) {
        console.error('Error', err, req.url);
        try {
          // TODO pass on to app's errorHandler
          res.writeHead(500);
          res.end('Error occurred, sorry.');
          res.on('close', function() {
            reqd.dispose();
          });
        } catch (err) {
          console.error('Error sending 500', err, req.url);
          reqd.dispose();
        }
      });
      // Call our app in the req domain
      reqd.bind(app)(req, res);
    }).listen(port, function(){
      console.log("Server listening on port " + port);
    });
  });

  return app;
};