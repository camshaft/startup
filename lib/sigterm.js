module.exports = function(server) {

  function handleClose() {
    if(server.shuttingDown) return;
    server.shuttingDown = true;
    console.log("Shutting down HTTP server");
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
