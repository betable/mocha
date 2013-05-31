var Runnable = require('./runnable')

/**
 * Initialize a new TestHook with the given title and hook function
 * TestHooks are beforeEach and afterEach hooks
 *
 * @param {String} title Title of this hook
 * @param {function} hook_function Function to run for this hook
 *
 * @constructor
 * @extends Runnable
 */
var TestHook = function (title, hook_function) {
    Runnable.call(this, title, hook_function)
}

TestHook.prototype.__proto__ = Runnable.prototype
module.exports = TestHook

/**
 * Clones a this test hook
 *
 * @param {Suite} [parent=this.parent] The parent suite to override this current suite
 *
 * @returns {TestHook} The new hook cloned from this hook
 */
TestHook.prototype.clone = function (parent) {
    var hook = new TestHook(this.title, this.test_function)
    hook.timeout(this.timeout())
    hook.exclusive(this.exclusive())
    hook.slow(this.slow())
    hook.parent = parent || this.parent
    return hook
}

/**
 * Run the hook_function
 *
 * @param {function()} callback A callback that is called once the hook_function has completed
 */
TestHook.prototype.run = function (callback) {
    var self = this

    callback = callback || function () {}

    if (self.state !== Runnable.STATE_WAITING) {
        return callback()
    }

    self.state = Runnable.STATE_RUNNING
    self.emit('started')

    self._run(function () {
        self.state = Runnable.STATE_COMPLETED

        //TODO: we need to put errors from this in the reporters
        if (self.errors.length > 0) {
            console.log(self.errors[0])
            console.log(self.errors[0].stack)
        }

        self.emit('completed')
        callback()
    })
}
