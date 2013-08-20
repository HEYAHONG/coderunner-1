/**
 * Module dependencies
 */

var fs = require('fs');
var path = require('path');
var join = path.join;
var Script = require('script/model');
var config = require('config');
var volume = config('script volume');
var superagent = require('superagent');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;

/**
 * Export `Run`
 */

module.exports = Run;

/**
 * Initialize `Run`
 */

function Run(obj, io) {
  if (!(this instanceof Run)) return new Run(obj, this);
  var self = this;
  var pending = 2;
  this.io = io;
  this.filename = [obj.id, obj.revision].join('-') + '.js';

  Script.find(obj.id, function(err, script) {
    if (err) return io.emit('error', err);
    self.script = script;
    script.source(obj.src);
    self.save(next);
    self.write(next);
  });

  function next(err) {
    if (err) return io.emit('error', err);
    else if (!--pending) {
      self.run(function(err) {
        if (err) io.emit('error', err);
        io.emit('ran');
      });
    }
  }
}

/**
 * Save the file
 *
 * @param {Function} fn
 * @return {Run}
 * @api private
 */

Run.prototype.save = function(fn) {
  var script = this.script;
  script.save(fn);
};

/**
 * Write the file to script volume
 *
 * @param {Function} fn
 * @return {Run}
 * @api private
 */

Run.prototype.write = function(fn) {
  var script = this.script;
  var source = script.source();
  var filename = path.join(volume, this.filename);
  fs.writeFile(filename, source, fn);
};

/**
 * Run the script
 */

Run.prototype.run = function(fn) {
  var io = this.io; 
  var args = [];
  args.push('docker');
  args.push('run');
  args.push('-v');
  args.push([volume, '/home'].join(':'));
  args.push('node-runner');
  args.push(join('/home', this.filename));

  var node = exec(args.join(' '), function(err, stdout, stderr) {
    if (err) return fn(err);
    if (stdout) return io.emit('stdout', stdout);
    if (stderr) return io.emit('stderr', stderr);
  });

  // close stdin immediately so we don't wait for it
  node.stdin.end();
};