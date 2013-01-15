module.exports = function(server) {

  function handleClose() {
    console.log("Shutting down HTTP server");
    server.close();
    process.exit();
  };

  process.once("SIGTERM", handleClose);
  process.once("SIGINT", handleClose);
};
