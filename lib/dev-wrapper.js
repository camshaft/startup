var path = require("path")
  , runner = require("./runner")
  , sigterm = require("./sigterm");

var main = path.resolve(process.cwd(), process.argv[2]);

var server = runner(main);

sigterm(server);
