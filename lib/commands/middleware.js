/**
 * Module dependencies
 */
var Table = require("cli-table");

/**
 * Print a table of the app middleware
 */
module.exports = function(path) {
  var app = require(path);

  if (!app.stack) {
    console.error("Express or Connect required for this command");
    process.exit(1);
  }

  var table = new Table({
    head: ["Route", "Name", "config"],
    colWidths: [20, 30, 80]
  });

  app.stack.forEach(function(middleware) {
    var name = middleware.name || middleware.handle.name || "";
    var configNames = [];
    var config = middleware.config || middleware.handle.config;
    if (config) {
      var properties = Object.getOwnPropertyNames(config);
      for (var i = properties.length - 1; i >= 0; i--) {
        configNames.push("config." + (name.length > 0 ? name + "." : "") + properties[i] + ": " + config[properties[i]]);
      };
    }
    table.push([(middleware.route || '/'), name, configNames.join("\n")]);
  });

  console.log(table.toString());
};
