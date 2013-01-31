
var child_process = require('child_process')
  , join = require("path").join
  , runner = require('../runner')
  , wrapper = join(__dirname,"/../wrapper");

module.exports = function(path, dev, clust) {

  if (process.env.NODE_ENV=="development" || dev) {

    console.log("Auto-Reload Enabled");

    var cmd = join(__dirname,"/../../node_modules/.bin/node-dev")
        args = [
          wrapper,
          path
        ];

    var child = child_process.spawn(cmd, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: [0, 1, 2, 'ipc']
    });

    process.on("message", function(m) {
      if(child) child.send(m);
    });
  }
  else {
    if (clust) {
      var cluster = require("cluster")
        , numCPUs = require('os').cpus().length;

      cluster.setupMaster({
        exec: wrapper,
        args: [path]
      });

      for (var i = 0; i < numCPUs; i++) {
        var worker = cluster.fork(process.env);
      };

      function handleSignal(m) {
        return function() {
          if(cluster.disconnecting) return;
          cluster.disconnecting = true;
          cluster.disconnect(function(){
            console.log("Shutting down master");
          });
        };
      };

      process.on("SIGTERM", handleSignal("SIGTERM"));
      process.on("SIGINT", handleSignal("SIGINT"));
    }
    else {
      var server = runner(path);
      require("../sigterm")(server);
    }
  };

};