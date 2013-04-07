/**
 * Module dependencies
 */
var cluster = require("cluster");

/**
 * Defines
 */
var TIMEOUT = process.env.SERVER_TIMEOUT || 7000;

/**
 * Apply signal handlers
 */
module.exports = function(server) {

  function handleClose() {
    if(server.shuttingDown) return;
    server.shuttingDown = true;
    console.log("Shutting down server"+(cluster.isWorker?" ("+cluster.worker.id+")":""));

    // If the server doesn't stop listening in time, we just exit
    // This is usually caused by an overwhelming number or requests
    var serverTimeout = setTimeout(function() {
      process.exit(1);
    }, TIMEOUT);

    try {
      // Stop accepting requests
      server.close(function() {
        clearTimeout(serverTimeout);
      });
    }
    catch (e) {
      // The server was already closed
    }
  };

  process.once("SIGTERM", handleClose);
  process.once("SIGINT", handleClose);
};
