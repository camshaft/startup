var cluster
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
    try {
      server.close();
    }
    catch (e) {
      // The server was already closed
    }
  };

  process.once("SIGTERM", handleClose);
  process.once("SIGINT", handleClose);
};
