
var child_process = require('child_process')
  , runner = require('../runner');

module.exports = function(path, dev) {

  if (process.env.NODE_ENV=="development" || dev) {

    console.log("Auto-Reload Enabled");

    var child = child_process.spawn(__dirname+"/../../node_modules/.bin/node-dev", [__dirname+"/../dev-wrapper", path]);

    child.stdout.on("data", function(data) {
      process.stdout.write(data);
    });
    child.stderr.on("data", function(data) {
      process.stdout.write(data);
    });
    child.on("exit", function(code) {
      process.exit(code);
    });

    process.once("SIGTERM", function() {
      child.kill();
    });
    process.once("SIGINT", function() {
      child.kill("SIGINT");
    });

  }
  else {
    var server = runner(path);

    require("../sigterm")(server);
  };

};