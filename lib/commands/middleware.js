
var Table = require("cli-table");

module.exports = function(path) {
  
  var app = require(path);

  var table = new Table({
    head: ["Route", "Name"],
    colWidths: [20, 60]
  });

  if (!app.stack) {
    console.error("Express or Connect required for this command");
    process.exit(1);
  }

  app.stack.forEach(function(middleware) {
    table.push([(middleware.route || '/'), (middleware.handle.name || middleware.name || "")]);
  });

  console.log(table.toString());

};
