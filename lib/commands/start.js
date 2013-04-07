/**
 * Module dependencies
 */
var child_process = require('child_process')
  , join = require("path").join
  , runner = require('../runner')
  , wrapper = join(__dirname,"/../wrapper")
  , cluster = require("cluster");

/**
 * Defines
 */
var TIMEOUT = process.env.SERVER_TIMEOUT || 7000
  , IS_DEV = process.env.NODE_ENV === "development";

/**
 * Start a server
 */
module.exports = function(path, dev) {

  if (IS_DEV || dev) {

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
    var numCPUs = require('os').cpus().length;

    cluster.setupMaster({
      exec: wrapper,
      args: [path]
    });

    for (var i = 0; i < numCPUs; i++) {
      cluster.fork(process.env);
    };

    cluster.on('disconnect', function(worker) {
      if(cluster.disconnecting || !worker.started) return;
      console.error('Client disconnected. Forking another worker.');
      cluster.fork();
    });

    cluster.on('listening', function(worker, address) {
      worker.started = true;
    });

    function handleSignal(m) {
      return function() {
        if(cluster.disconnecting) return;
        cluster.disconnecting = true;
        // Give workers just a bit more time to die on their own
        var killTimer = setTimeout(function() {
          for (var id in cluster.workers) {
            var worker = cluster.workers[id];
            console.log("Killing server("+worker.id+") because it took longer than "+TIMEOUT+"ms to shutdown.");
            worker.process.kill('SIGKILL');
          }
        }, TIMEOUT+300);

        // Dereference it from the loop
        if(killTimer.unref) killTimer.unref();

        cluster.disconnect(function(){
          console.log("Shutting down master");
          clearTimeout(killTimer);
        });
      };
    };

    process.once("SIGTERM", handleSignal("SIGTERM"));
    process.once("SIGINT", handleSignal("SIGINT"));
  };
};
