/*!
 * mocha
 * Copyright(c) 2011 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var path = require('path')
  , utils = require('./utils')
  , util = require('util')
  , mkdirp = require('mkdirp')
  , fs = require('fs')
  , domain = require('domain')

/**
 * Expose `Mocha`.
 */

exports = module.exports = Mocha;

/**
 * Expose internals.
 */

exports.utils = utils;
exports.interfaces = require('./interfaces');
exports.reporters = require('./reporters');
exports.Runnable = require('./runnable');
exports.Context = require('./context');
exports.Runner = require('./runner');
exports.Suite = require('./Suite');
exports.SuiteHook = require('./SuiteHook');
exports.TestHook = require('./TestHook');
exports.Test = require('./Test');

/**
 * Return image `name` path.
 *
 * @param {String} name
 * @return {String}
 * @api private
 */

function image(name) {
  return __dirname + '/../images/' + name + '.png';
}

/**
 * Setup mocha with `options`.
 *
 * @param {Object} [options]
 * @param {Object} [options.ui] name "bdd", "tdd", "exports" etc
 * @param {Object} [options.reporter] reporter instance, defaults to `mocha.reporters.Dot`
 * @param {Object} [options.globals] array of accepted globals
 * @param {Object} [options.timeout] timeout in milliseconds
 * @param {Object} [options.bail] bail on the first test failure
 * @param {Object} [options.slow] milliseconds to wait before considering a test slow
 * @param {Object} [options.ignoreLeaks] ignore global leaks
 * @param {Object} [options.grep] string or regexp to filter tests with
 */
function Mocha(options) {
    options = options || {}
    this.files = []
    this.options = options
    this.grep(options.grep)
    this.suite = new exports.Suite('', undefined)
    this.ui(options.ui)
    this._reporters = []

    if (options.timeout) {
        this.timeout(options.timeout)
    }

    if (options.slow) {
        this.slow(options.slow)
    }
}

/**
 * Add test `file`.
 *
 * @param {String} file
 * @api public
 */

Mocha.prototype.addFile = function(file){
  this.files.push(file);
  return this;
};

/**
 * Adds a reporter to the runner
 *
 * @param {String|Function} reporter name or constructor
 * @param {String} [out_path] A file path to write the reporter output to, if nothing is provided stdout is used
 *
 * @return {Mocha} this for chaining
 */
Mocha.prototype.add_reporter = function (reporter, out_path) {
    var get_writer = function (out_path) {
        if (!out_path) {
            return function () {
                process.stdout.write(util.format.apply(util, arguments) + '\n')
            }
        }

        mkdirp.sync(path.dirname(out_path))
        var fd = fs.openSync(out_path, 'w', 0644)

        return function () {
            fs.writeSync(fd, util.format.apply(util, arguments) + '\n', null, 'utf8')
        }
    }

    if ('function' == typeof reporter) {
        this._reporters.push({ ctor: reporter, writer: get_writer(out_path) })

    } else {
        var ctor

        try {
            ctor = require('./reporters/' + reporter)
        } catch (err) {
            try {
                ctor = require(reporter)
            } catch (err) {}
        }

        if (typeof ctor !== 'function') {
            throw new Error('invalid reporter "' + reporter + '"')
        }

        this._reporters.push({ ctor: ctor, writer: get_writer(out_path) })
    }

    return this
}

/**
 * Set test UI `name`, defaults to "bdd".
 *
 * @param {String} bdd
 * @api public
 */

Mocha.prototype.ui = function(name){
  name = name || 'bdd';
  this._ui = exports.interfaces[name];
  if (!this._ui) throw new Error('invalid interface "' + name + '"');
  this._ui = this._ui(this.suite);
  return this;
};

/**
 * Load registered files.
 *
 * @api private
 */

Mocha.prototype.loadFiles = function(fn){
  var self = this;
  var suite = this.suite;
  var pending = this.files.length;
  this.files.forEach(function(file){
    file = path.resolve(file);
    suite.emit('pre-require', global, file, self);
    suite.emit('require', require(file), file, self);
    suite.emit('post-require', global, file, self);
    --pending || (fn && fn());
  });
};

/**
 * Enable growl support.
 *
 * @api private
 */

Mocha.prototype._growl = function(runner, reporter) {
  var notify = require('growl');

  runner.on('end', function(){
    var stats = reporter.stats;
    if (stats.failures) {
      var msg = stats.failures + ' of ' + runner.total + ' tests failed';
      notify(msg, { name: 'mocha', title: 'Failed', image: image('error') });
    } else {
      notify(stats.passes + ' tests passed in ' + stats.duration + 'ms', {
          name: 'mocha'
        , title: 'Passed'
        , image: image('ok')
      });
    }
  });
};

/**
 * Add regexp to grep, if `re` is a string it is escaped.
 *
 * @param {RegExp|String} re
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.grep = function(re){
  this.options.grep = 'string' == typeof re
    ? new RegExp(utils.escapeRegexp(re))
    : re;
  return this;
};

/**
 * Invert `.grep()` matches.
 *
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.invert = function(){
  this.options.invert = true;
  return this;
};

/**
 * Ignore global leaks.
 *
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.ignoreLeaks = function(){
  this.options.ignoreLeaks = true;
  return this;
};

/**
 * Enable global leak checking.
 *
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.checkLeaks = function(){
  this.options.ignoreLeaks = false;
  return this;
};

/**
 * Enable growl support.
 *
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.growl = function(){
  this.options.growl = true;
  return this;
};

/**
 * Ignore `globals` array or string.
 *
 * @param {Array|String} globals
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.globals = function(globals){
  this.options.globals = (this.options.globals || []).concat(globals);
  return this;
};

/**
 * Set the timeout in milliseconds.
 *
 * @param {Number} timeout
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.timeout = function(timeout){
  this.suite.timeout(timeout);
  return this;
};

/**
 * Set slowness threshold in milliseconds.
 *
 * @param {Number} slow
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.slow = function(slow){
  this.suite.slow(slow);
  return this;
};

/**
 * Makes all tests async (accepting a callback)
 *
 * @return {Mocha}
 * @api public
 */

Mocha.prototype.asyncOnly = function(){
  this.options.asyncOnly = true;
  return this;
};

/**
 * Run tests and invoke `callback()` when complete.
 *
 * @param {Function} callback A callback that will be called when the runner completes
 *
 * @return {Runner} The runner object running the tests
 */
Mocha.prototype.run = function (callback) {
    var runner_domain = domain.create()
      , runner
      , reporters = []

    runner_domain.on('error', function (error) {
        console.log(error.stack)
    })

    if (this.files.length) {
        this.loadFiles()
    }

    runner = new exports.Runner(this.suite)

    if (this._reporters.length === 0) {
        this.add_reporter('dot')
    }

    this._reporters.forEach(function (reporter) {
        reporters.push(new reporter.ctor(runner, reporter.writer))
    })

    var options = this.options

    runner.ignoreLeaks = false !== options.ignoreLeaks
    runner.asyncOnly = options.asyncOnly

    if (options.grep) {
        runner.grep(options.grep, options.invert)
    }

    if (options.globals) {
        runner.globals(options.globals)
    }

    if (options.growl) {
        this._growl(runner, reporters)
    }

    runner_domain.run(function () {
        runner.run(callback)
    })

    return runner
}
