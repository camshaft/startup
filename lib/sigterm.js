module.exports = function(server) {

  function handleClose() {
    console.log("Shutting down HTTP server");
    server.close(function() {
      console.log("Exiting");
      process.exit();
    });
  };

  process.once("SIGTERM", handleClose);
  process.once("SIGINT", handleClose);
};
