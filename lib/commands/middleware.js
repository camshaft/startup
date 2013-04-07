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
    head: ["Route", "Name"],
    colWidths: [20, 60]
  });

  app.stack.forEach(function(middleware) {
    table.push([(middleware.route || '/'), (middleware.name || middleware.handle.name || "")]);
  });

  console.log(table.toString());
};
