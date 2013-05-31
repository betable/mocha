var EventEmitter = require('events').EventEmitter
  , milliseconds = require('./ms')
  , utils = require('./utils')
  , SuiteHook = require('./suitehook')
  , TestHook = require('./testhook')
  , Context = require('./context')
  , _ = require('underscore')

/**
 * Initialize a new `Suite` with the given `title` and `parent`.
 *
 * @param {String} title Title for this suite
 */
var Suite = function(title) {
    this.title = title
    this.parent = undefined
    this.suites = []
    this.tests = []
    this.skipped = false
    this.root = !title
    this.only = false
    this.hasOnlyObjects = false
    this.onlyObjects = false

    this._beforeEach = []
    this._beforeAll = []
    this._afterEach = []
    this._afterAll = []
    this._next_dependencies = []
    this._exclusive = false
    this._timeout = 2000
    this._slow = 75
    this._context = undefined
}

Suite.prototype.__proto__ = EventEmitter.prototype

module.exports = Suite

/**
 * Return a clone of this `Suite`.
 *
 * @return {Suite} The new suite object
 */
Suite.prototype.clone = function() {
    var suite = new Suite(this.title)
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
    var hook = new SuiteHook('before all hook ' + (this._beforeAll.length + 1), fn)
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
    var hook = new SuiteHook('after all hook ' + (this._afterAll.length + 1), fn)
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
    var hook = new TestHook('before each hook ' + (this._beforeEach.length + 1), fn)
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
    var hook = new TestHook('after each hook ' + (this._afterEach.length + 1), fn)
    hook.parent = this
    hook.timeout(this.timeout())
    hook.slow(this.slow())
    hook.skipped = hook.skipped || this.skipped
    this._afterEach.push(hook)
    this.emit('afterEach', hook)
    return this
}

/**
 * Returns all test and beforeAll/afterAll hooks to be run.
 *
 * @returns {Array.<Runnable>} An array of tests and hooks in order
 */
Suite.prototype.allTests = function () {
    if (this.tests.length === 0) {
        return []
    }

    if (this.onlyObjects && !this.hasOnlyObjects) {
        this._beforeAll.forEach(function (hook) {
            hook.skipped = true
        })

        this._afterAll.forEach(function (hook) {
            hook.skipped = true
        })
    }

    return this._beforeAll.concat(this.tests, this._afterAll)
}

/**
 * Sets that there are tests that have been only'd
 * Checks this test to see if it has an only'd test and notifies it's parents
 */
Suite.prototype.markOnlyObjects = function () {
    //TODO: Should probably mark these as skipped before we get here
    //TODO: Save onlys until the end and then calc?
    var self = this

    self.onlyObjects = true

    if (self.only) {
        self.hasOnlyObjects = true
    } else {
        self.tests.forEach(function (test) {
            if (test.only) {
                self.hasOnlyObjects = true
            } else {
                test.skipped = true
            }
        })
    }

    if (self.hasOnlyObjects) {
        self.parents().forEach(function (parent) {
            parent.hasOnlyObjects = true
        })
    }

    self.suites.forEach(function (suite) {
        suite.markOnlyObjects()
    })
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
    suite.skipped = suite.skipped || this.skipped || (this.onlyObjects && !suite.only)
    suite.parent = this
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
    test.only = test.only || this.only
    test.skipped = test.skipped || this.skipped || (this.onlyObjects && !test.only)
    this.tests.push(test)
    this.emit('test', test)

    if (test.only) {
        var parents = this.parents()
        parents[parents.length - 1].markOnlyObjects()
    }

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
Suite.prototype.full_title = function (separator) {
    if (this.parent) {
        separator = separator || ' '
        var full = this.parent.full_title(separator)

        if (full) {
            return full + separator + this.title
        }
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
