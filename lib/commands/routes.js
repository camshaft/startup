/**
 * Module dependencies
 */
var Table = require("cli-table");

/**
 * Print a table of the app routes
 */
module.exports = function(path) {

  var app = require(path);

  if (!app.routes) {
    console.error("Express required for this command");
    process.exit(1);
  }

  var table = new Table({
    head: ["Method", "Route", "Callbacks"],
    colWidths: [8, 20, 70]
  });

  for(var method in app.routes) {
    app.routes[method].forEach(function(route) {
      table.push([method, route.path, route.callbacks.join("\n")]);
    });
  }

  console.log(table.toString());
};
