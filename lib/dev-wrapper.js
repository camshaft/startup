var path = require("path")
  , runner = require("./runner");

var main = path.resolve(process.cwd(), process.argv[2]);

runner(main);
