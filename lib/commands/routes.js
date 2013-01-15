
var Table = require("cli-table");

module.exports = function(path) {

  var app = require(path);

  var table = new Table({
    head: ["Method", "Route", "Callbacks"],
    colWidths: [8, 20, 70]
  });

  if (!app.routes) {
    console.error("Express required for this command");
    process.exit(1);
  }

  for(var method in app.routes) {
    app.routes[method].forEach(function(route) {
      table.push([method, route.path, route.callbacks.join("\n")]);
    });
  }

  console.log(table.toString());

};
