var EventEmitter = require('events').EventEmitter
  , milliseconds = require('./ms')
  , utils = require('./utils')
  , Hook = require('./hook')
  , Context = require('./context')
  , _ = require('underscore')

/**
 * Initialize a new `Suite` with the given `title` and `parent`.
 *
 * @param {String} title Title for this suite
 * @param {Suite} parent Parent of this suite
 */
var Suite = function(title, parent) {
    this.title = title
    this.parent = parent
    this.suites = []
    this.tests = []
    this.skipped = false
    this._beforeEach = []
    this._beforeAll = []
    this._afterEach = []
    this._afterAll = []
    this.root = !title

    this._next_dependencies = []
    this._exclusive = false
    this._timeout = 2000
    this._slow = 75
    this._context = undefined

    if (this.parent) {
        this.parent.addSuite(this)
    }
}

Suite.prototype.__proto__ = EventEmitter.prototype
module.exports = Suite

/**
 * Return a clone of this `Suite`.
 *
 * @return {Suite} The new suite object
 */
Suite.prototype.clone = function() {
    var suite = new Suite(this.title, this.parent)
    suite.timeout(this.timeout())
    suite.slow(this.slow())
    return suite
}

/**
 * Set timeout `ms` or short-hand such as "2s".
 *
 * @param {Number|String} ms
 * @return {Suite|Number} for chaining
 * @api private
 */
Suite.prototype.timeout = function(ms){
    if (0 == arguments.length) {
        return this._timeout
    }

    if ('string' == typeof ms) {
        ms = milliseconds(ms)
    }


    this._timeout = parseInt(ms, 10)
    return this
}

/**
 * Set slow `ms` or short-hand such as "2s".
 *
 * @param {Number|String} ms
 * @return {Suite|Number} for chaining
 * @api private
 */
Suite.prototype.slow = function(ms){
    if (0 === arguments.length) {
        return this._slow
    }

    if ('string' == typeof ms) {
        ms = milliseconds(ms)
    }

    this._slow = ms
    return this
}

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

/**
 * Gets the context that tests under this suite should run in
 * Shallow copies the parent context
 *
 * @return {Context} the context to run tests in
 */
Suite.prototype.context = function () {
    if (this._context) {
        return this._context
    }

    var context

    this.parents().some(function (suite) {
        return (context = suite.context())
    })

    if (context) {
        return this._context = _.clone(context)
    }

    return new Context()
}

Suite.prototype.parents = function () {
    var parent = this
        , parents = []

    while (parent && (parent = parent.parent)) {
        parents.push(parent)
    }

    return parents
}

Suite.prototype.exclusive = function (exclusive) {
    if (0 == arguments.length) {
        return this._exclusive
    }

    this._exclusive = exclusive
    return this
}

/**
 * Run `fn(test[, done])` before running tests.
 *
 * @param {Function} fn
 * @return {Suite} for chaining
 * @api private
 */
Suite.prototype.beforeAll = function (fn) {
    var hook = new Hook('before all hook ' + (this._beforeAll.length + 1), fn)
    hook.parent = this
    hook.timeout(this.timeout())
    hook.slow(this.slow())
    hook.skipped = hook.skipped || this.skipped
    this._beforeAll.push(hook)
    this.emit('beforeAll', hook)
    return this
}

/**
 * Run `fn(test[, done])` after running tests.
 *
 * @param {Function} fn
 * @return {Suite} for chaining
 * @api private
 */
Suite.prototype.afterAll = function (fn) {
    var hook = new Hook('after all hook ' + (this._afterAll.length + 1), fn)
    hook.parent = this
    hook.timeout(this.timeout())
    hook.slow(this.slow())
    hook.skipped = hook.skipped || this.skipped
    this._afterAll.push(hook)
    this.emit('afterAll', hook)
    return this
}

/**
 * Run `fn(test[, done])` before each test case.
 *
 * @param {Function} fn
 * @return {Suite} for chaining
 * @api private
 */
Suite.prototype.beforeEach = function (fn) {
    var hook = new Hook('before each hook ' + (this._beforeEach.length + 1), fn)
    hook.parent = this
    hook.timeout(this.timeout())
    hook.slow(this.slow())
    hook.skipped = hook.skipped || this.skipped
    this._beforeEach.push(hook)
    this.emit('beforeEach', hook)
    return this
}

/**
 * Run `fn(test[, done])` after each test case.
 *
 * @param {Function} fn
 * @return {Suite} for chaining
 * @api private
 */
Suite.prototype.afterEach = function (fn) {
    var hook = new Hook('after each hook ' + (this._afterEach.length + 1), fn)
    hook.parent = this
    hook.timeout(this.timeout())
    hook.slow(this.slow())
    hook.skipped = hook.skipped || this.skipped
    this._afterEach.push(hook)
    this.emit('afterEach', hook)
    return this
}

//TODO: this can be better
Suite.prototype.allBeforeEachHooks = function () {
    var hooks = []

    if (this.parent) {
        hooks = this.parent.allBeforeEachHooks()
    }

    return hooks.concat(this._beforeEach)
}

//TODO: this can be better
Suite.prototype.allAfterEachHooks = function () {
    var hooks = []

    if (this.parent) {
        hooks = this.parent.allAfterEachHooks()
    }

    return hooks.concat(this._afterEach)
}

Suite.prototype.allTests = function () {
    if (this._all_tests) {
        return this._all_tests
    }

    function init_each (test, each) {
        var new_each = each.clone()
        new_each.title = test.title + ' - ' + each.fullTitle('/')
        new_each.parent = self
        new_each.skipped = new_each.skipped || test.skipped
        self._all_tests.push(new_each)
    }

    var self = this
    self._all_tests = self._beforeAll

    self.tests.forEach(function (test) {
        self.allBeforeEachHooks().forEach(function (hook) {
            init_each(test, hook)
        })

        self._all_tests.push(test)

        self.allAfterEachHooks().forEach(function (hook) {
            init_each(test, hook)
        })
    })

    self._all_tests = self._all_tests.concat(self._afterAll)
    return self._all_tests
}

/**
 * Add a test `suite` as a child.
 *
 * @param {Suite} suite The suite to add as a child
 *
 * @return {Suite} This suite for chaining
 */
Suite.prototype.addSuite = function (suite) {
    suite.timeout(this.timeout())
    suite.slow(this.slow())
    suite.skipped = suite.skipped || this.skipped
    this.suites.push(suite)
    this.emit('suite', suite)
    return this
}

/**
 * Add a `test` to this suite.
 *
 * @param {Test} test
 * @return {Suite} for chaining
 * @api private
 */
Suite.prototype.addTest = function (test) {
    test.parent = this
    test.timeout(this.timeout())
    test.slow(this.slow())
    test.skipped = test.skipped || this.skipped
    this.tests.push(test)
    this.emit('test', test)
    return this
}

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
Suite.prototype.fullTitle = function (separator) {
    if (this.parent) {
        separator = separator || ' '
        var full = this.parent.fullTitle(separator)
        if (full) return full + separator + this.title
    }

    return this.title
}

/**
 * Return the total number of tests.
 *
 * @return {Number}
 * @api public
 */
Suite.prototype.total = function () {
    return utils.reduce(this.suites, function (sum, suite) {
        return sum + suite.total()
    }, 0) + this.tests.length
}
