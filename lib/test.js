var Runnable = require('./runnable')

/**
 * Initialize a new Test with the given title and test function
 * Test is an actual test case
 *
 * @param {Runnable} title Title of the root node
 * @param {Function} test_function Function to call when it is our turn
 *
 * @constructor
 * @extends Runnable
 */
var Test = function (title, test_function) {
    Runnable.call(this, title, test_function)

    this._beforeEach = null
    this._afterEach = null
}

Test.prototype.__proto__ = Runnable.prototype
module.exports = Test

/**
 * Set & get exclusive value
 * If a test is exclusive then no other test can run during its execution, exclusive tests slow everything down
 *
 * @param {boolean|undefined} exclusive True or false to set exclusivity or undefined to get the value
 *
 * @returns {boolean|Runnable} Either the boolean for exclusivity or this for chaining
 */
Test.prototype.exclusive = function (exclusive) {
    if (0 == arguments.length) {
        if (this._exclusive) {
            return this._exclusive
        }

        var hooks = this.allBeforeEach().concat(this.allAfterEach())
          , is_exclusive = false

        hooks.some(function (hook) {
            return (is_exclusive = hook.exclusive())
        })

        return is_exclusive
    }

    this._exclusive = exclusive
    return this
}

/**
 * Provides all the before each hooks for this test
 *
 * @returns {Array.<TestHook>} An array of hooks that will run before this test
 */
Test.prototype.allBeforeEach = function () {
    return this._all_each('_beforeEach')
}

/**
 * Provides all the after each hooks for this test
 *
 * @returns {Array.<TestHook>} An array of hooks that will run after this test
 */
Test.prototype.allAfterEach = function () {
    return this._all_each('_afterEach')
}

/**
 * Helper function to get all hooks of for either before or after
 *
 * @param {String} type Either 'before' or 'after'
 *
 * @returns {Array.<TestHook>} An array of the specified hook type
 *
 * @private
 */
Test.prototype._all_each = function (type) {
    if (!this.parent) {
        return []
    }

    if (Array.isArray(this[type])) {
        return this[type]
    }

    var parents = this.parent.parents()
      , self = this

    parents.unshift(this.parent)
    self[type] = []

    for (var i = parents.length - 1; i >= 0; i--) {
        parents[i][type].forEach(function (hook) {
            var new_hook = hook.clone(self.parent)
            new_hook.skipped = new_hook.skipped || self.skipped

            self[type].push(new_hook)
        })
    }

    return self[type]
}

/**
 * Run the test_function
 * Runs before each and after each tests
 *
 * @param {function()} [callback] A callback that is called once the test_function has completed
 */
Test.prototype.run = function (callback) {
    var self = this

    callback = callback || function () {}

    if (self.state !== Runnable.STATE_WAITING) {
        return callback()
    }

    if (self.errors.length > 0) {
        self._complete()
        self.state = Runnable.STATE_COMPLETED
        self.emit('completed')
        return callback()
    }

    self.state = Runnable.STATE_BEFORE_HOOKS
    self.emit('started')

    self._each_hook(self.allBeforeEach(), function () {
        self.state = Runnable.STATE_RUNNING

        self._run(function () {
            self.state = Runnable.STATE_AFTER_HOOKS

            self._each_hook(self.allAfterEach(), function () {
                self.state = Runnable.STATE_COMPLETED
                self.emit('completed')
                callback()
            })
        })
    })
}

/**
 * Runs all the provided hooks in series
 *
 * @param {Array.<Hook>} hooks An array of hooks to run
 * @param {function} callback A function to call when all hooks have completed
 *
 * @private
 */
Test.prototype._each_hook = function (hooks, callback) {
    //TODO: Use .fail ?
    var self = this
      , completed = 0

    if (hooks.length === 0 || self.errors.length > 0) {
        return callback()
    }

    var run_hook = function (hook, inner_callback) {
        var next = true

        //TODO need to print the hook error out somehow
        hook.run(function () {
            if (hook.errors.length > 0) {
                self._complete(new Error(hook.full_title('/') + ' failed'))
                next = false
            }

            inner_callback(next)
        })
    }

    var next_hook = function () {
        run_hook(hooks[completed], function (run_next) {
            if (run_next === false) {
                return callback()
            }

            completed += 1
            if (completed >= hooks.length) {
                callback()
            } else {
                next_hook()
            }
        })
    }

    next_hook()
}
