
var Table = require("cli-table");

module.exports = function(path) {

  var app = require(path);

  var table = new Table({
    head: ["Key", "Value"],
    colWidths: [20, 80]
  });

  if (!app.settings) {
    console.error("Express required for this command");
    process.exit(1);
  }

  for(var key in app.settings) {
    table.push([key, app.settings[key]]);
  }

  console.log(table.toString());
};
