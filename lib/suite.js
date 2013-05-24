
/**
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  , debug = require('debug')('mocha:suite')
  , milliseconds = require('./ms')
  , utils = require('./utils')
  , Hook = require('./hook');

/**
 * Expose `Suite`.
 */

exports = module.exports = Suite;

/**
 * Create a new `Suite` with the given `title`
 * and parent `Suite`. When a suite with the
 * same title is already present, that suite
 * is returned to provide nicer reporter
 * and more flexible meta-testing.
 *
 * @param {Suite} parent
 * @param {String} title
 * @return {Suite}
 * @api public
 */

exports.create = function(parent, title){
  var suite = new Suite(title, parent.ctx);
  suite.parent = parent;
  if (parent.pending) suite.pending = true;
  title = suite.fullTitle();
  parent.addSuite(suite);
  return suite;
};

/**
 * Initialize a new `Suite` with the given
 * `title` and `ctx`.
 *
 * @param {String} title
 * @param {Context} ctx
 * @api private
 */

function Suite(title, ctx) {
    this.title = title
    this.ctx = ctx
    this.suites = []
    this.tests = []
    this.pending = false
    this._beforeEach = []
    this._beforeAll = []
    this._afterEach = []
    this._afterAll = []
    this.root = !title

    this._next_dependencies = []
    this._exclusive = false
    this._timeout = 2000
    this._slow = 75
    this._bail = false
}

/**
 * Inherit from `EventEmitter.prototype`.
 */

Suite.prototype.__proto__ = EventEmitter.prototype;

/**
 * Return a clone of this `Suite`.
 *
 * @return {Suite}
 * @api private
 */

Suite.prototype.clone = function(){
  var suite = new Suite(this.title);
  debug('clone');
  suite.ctx = this.ctx;
  suite.timeout(this.timeout());
  suite.slow(this.slow());
  suite.bail(this.bail());
  return suite;
};

/**
 * Set timeout `ms` or short-hand such as "2s".
 *
 * @param {Number|String} ms
 * @return {Suite|Number} for chaining
 * @api private
 */

Suite.prototype.timeout = function(ms){
  if (0 == arguments.length) return this._timeout;
  if ('string' == typeof ms) ms = milliseconds(ms);
  debug('timeout %d', ms);
  this._timeout = parseInt(ms, 10);
  return this;
};

/**
 * Set slow `ms` or short-hand such as "2s".
 *
 * @param {Number|String} ms
 * @return {Suite|Number} for chaining
 * @api private
 */

Suite.prototype.slow = function(ms){
  if (0 === arguments.length) return this._slow;
  if ('string' == typeof ms) ms = milliseconds(ms);
  debug('slow %d', ms);
  this._slow = ms;
  return this;
};

/**
 * Either sets or gets the array of dependencies for the next test
 *
 * @param {Array.<Runnable>} [dependencies] An array of dependencies
 *
 * @return {Array.<Runnable>|Boolean} True if setting, The array of dependencies if not
 */
Suite.prototype.next_dependencies = function (dependencies) {
    if (arguments.length === 0) {
        if (this._next_dependencies.length === 0 && this.parent) {
            return this.parent.next_dependencies()
        }

        return this._next_dependencies
    }

    return this._next_dependencies = dependencies
}

Suite.prototype.exclusive = function (exclusive) {
    if (0 == arguments.length) {
       return this._exclusive
    }

    this._exclusive = exclusive
    return this
};

/**
 * Sets whether to bail after first error.
 *
 * @parma {Boolean} bail
 * @return {Suite|Number} for chaining
 * @api private
 */

Suite.prototype.bail = function(bail){
  if (0 == arguments.length) return this._bail;
  debug('bail %s', bail);
  this._bail = bail;
  return this;
};

/**
 * Run `fn(test[, done])` before running tests.
 *
 * @param {Function} fn
 * @return {Suite} for chaining
 * @api private
 */

Suite.prototype.beforeAll = function(fn){
  if (this.pending) return this;
  var hook = new Hook('before all hook ' + (this._beforeAll.length + 1), fn);
  hook.parent = this;
  hook.timeout(this.timeout());
  hook.slow(this.slow());
  hook.ctx = this.ctx;
  this._beforeAll.push(hook);
  this.emit('beforeAll', hook);
  return this;
};

/**
 * Run `fn(test[, done])` after running tests.
 *
 * @param {Function} fn
 * @return {Suite} for chaining
 * @api private
 */

Suite.prototype.afterAll = function(fn){
  if (this.pending) return this;
  var hook = new Hook('after all hook ' + (this._afterAll.length + 1), fn);
  hook.parent = this;
  hook.timeout(this.timeout());
  hook.slow(this.slow());
  hook.ctx = this.ctx;
  this._afterAll.push(hook);
  this.emit('afterAll', hook);
  return this;
};

/**
 * Run `fn(test[, done])` before each test case.
 *
 * @param {Function} fn
 * @return {Suite} for chaining
 * @api private
 */

Suite.prototype.beforeEach = function(fn){
  if (this.pending) return this;
  var hook = new Hook('before each hook ' + (this._beforeEach.length + 1), fn);
  hook.parent = this;
  hook.timeout(this.timeout());
  hook.slow(this.slow());
  hook.ctx = this.ctx;
  this._beforeEach.push(hook);
  this.emit('beforeEach', hook);
  return this;
};

/**
 * Run `fn(test[, done])` after each test case.
 *
 * @param {Function} fn
 * @return {Suite} for chaining
 * @api private
 */

Suite.prototype.afterEach = function(fn){
  if (this.pending) return this;
  var hook = new Hook('after each hook ' + (this._afterEach.length + 1), fn);
  hook.parent = this;
  hook.timeout(this.timeout());
  hook.slow(this.slow());
  hook.ctx = this.ctx;
  this._afterEach.push(hook);
  this.emit('afterEach', hook);
  return this;
};

Suite.prototype.allEachHooks = function () {
    return this.allBeforeEachHooks().concat(this.allAfterEachHooks())
}

Suite.prototype.allBeforeEachHooks = function () {
    var hooks = []

    if (this.parent) {
        hooks = this.parent.allBeforeEachHooks()
    }
    return this._beforeEach.concat(hooks)
}

Suite.prototype.allAfterEachHooks = function () {
    var hooks = []
    if (this.parent) {
        hooks = this.parent.allAfterEachHooks()
    }
    return this._afterEach.concat(hooks)
}

Suite.prototype.allTests = function () {
    if (this._all_tests) {
        return this._all_tests
    }

    function init_each (each) {
        var new_each = each.clone()
        new_each.parent = self
        new_each.ctx = self.ctx
        new_each.title = each.fullTitle('/')
        self._all_tests.push(new_each)
    }

    var self = this
    self._all_tests = self._beforeAll

    self.tests.forEach(function (test) {
        self.allBeforeEachHooks().forEach(init_each)

        self._all_tests.push(test)

        self.allAfterEachHooks().forEach(init_each)
    })

    self._all_tests.push.apply(self._all_tests, self._afterAll)
    return self._all_tests
}

/**
 * Add a test `suite`.
 *
 * @param {Suite} suite
 * @return {Suite} for chaining
 * @api private
 */

Suite.prototype.addSuite = function(suite){
  suite.parent = this;
  suite.timeout(this.timeout());
  suite.slow(this.slow());
  suite.bail(this.bail());
  this.suites.push(suite);
  this.emit('suite', suite);
  return this;
};

/**
 * Add a `test` to this suite.
 *
 * @param {Test} test
 * @return {Suite} for chaining
 * @api private
 */

Suite.prototype.addTest = function(test){
  test.parent = this;
  test.timeout(this.timeout());
  test.slow(this.slow());
  test.ctx = this.ctx;
  this.tests.push(test);
  this.emit('test', test);
  return this;
};

/**
 * Return the full title generated by recursively
 * concatenating the parent's full title.
 *
 * @param {String} [separator=' '] The string that will separate each parent
 *
 * @return {String}
 *
 * @api public
 */
Suite.prototype.fullTitle = function(separator){
  if (this.parent) {
    separator = separator || ' '
    var full = this.parent.fullTitle(separator);
    if (full) return full + separator + this.title;
  }
  return this.title;
};

/**
 * Return the total number of tests.
 *
 * @return {Number}
 * @api public
 */

Suite.prototype.total = function(){
  return utils.reduce(this.suites, function(sum, suite){
    return sum + suite.total();
  }, 0) + this.tests.length;
};

/**
 * Iterates through each suite recursively to find
 * all tests. Applies a function in the format
 * `fn(test)`.
 *
 * @param {Function} fn
 * @return {Suite}
 * @api private
 */

Suite.prototype.eachTest = function(fn){
  utils.forEach(this.tests, fn);
  utils.forEach(this.suites, function(suite){
    suite.eachTest(fn);
  });
  return this;
};
