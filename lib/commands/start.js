
var child_process = require('child_process')
  , join = require("path").join
  , runner = require('../runner');

module.exports = function(path, dev) {

  if (process.env.NODE_ENV=="development" || dev) {

    console.log("Auto-Reload Enabled");

    var cmd = join(__dirname,"/../../node_modules/.bin/node-dev")
        args = [
          join(__dirname,"/../dev-wrapper"),
          path
        ];

    var child = child_process.spawn(cmd, args, {
      cwd: process.cwd(),
      env: process.env,
      customFds: [0, 1, 2],
      stdio: [0, 1, 2, 'ipc']
    });

    child.on("message", function(m) {
      if(process) process.send(m);
    });

    process.on("message", function(m) {
      if(child) child.send(m);
    });
  }
  else {
    var server = runner(path);

    require("../sigterm")(server);
  };

};