var cluster
  , timeout = process.env.SERVER_TIMEOUT || 7000
  , isWorker = false;

try {
  cluster = require("cluster");
  isWorker = cluster.isWorker;
}
catch (e) {
  // Do nothing; we don't have cluster
}

module.exports = function(server) {

  function handleClose() {
    if(server.shuttingDown) return;
    server.shuttingDown = true;
    console.log("Shutting down server"+(isWorker?" ("+cluster.worker.id+")":""));

    // If the server doesn't stop listening in time, we just exit
    // This is usually caused by an overwhelming number or requests
    var serverTimeout = setTimeout(function() {
      process.exit(1);
    }, timeout);

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
