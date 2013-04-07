/**
 * Module dependencies
 */
var Table = require("cli-table");

/**
 * Print a table of the app settions
 */
module.exports = function(path) {

  var app = require(path);

  if (!app.settings) {
    console.error("Express required for this command");
    process.exit(1);
  }

  var table = new Table({
    head: ["Key", "Value"],
    colWidths: [20, 80]
  });

  for(var key in app.settings) {
    table.push([key, app.settings[key]]);
  }

  console.log(table.toString());
};
