/**
 * Module dependencies
 */
var express = require('express');

/**
 * Expose app to startup
 */
var app = module.exports = express();

/**
 * Configure the app
 */
app.configure(function() {
  app.set('views', __dirname);
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(app.router);
  app.use(express.errorHandler());
});

/**
 * Routes
 */
app.get('/', function(req, res) {
  res.send('Hello');
});

app.get('/busy', function(req, res) {
  var i = 0, dostuff = true;
  while (i < 1e9) i++;
  res.send('I counted to ' + i);
});

app.get('/error', function(req, res) {
  process.nextTick(function() {
    JSON.parse('{]');
  });
});
