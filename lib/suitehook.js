var Runnable = require('./runnable')

/**
 * Initialize a new SuiteHook with the given title and hook function
 * SuiteHooks are before and after hooks
 *
 * @param {String} title Title of this hook
 * @param {function} hook_function Function to run for this hook
 *
 * @constructor
 * @extends Runnable
 */
var SuiteHook = function (title, hook_function) {
    Runnable.call(this, title, hook_function)
}

SuiteHook.prototype.__proto__ = Runnable.prototype
module.exports = SuiteHook

/**
 * Run the hook_function
 *
 * @param {function()} callback A callback that is called once the hook_function has completed
 */
SuiteHook.prototype.run = function (callback) {
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

    self.state = Runnable.STATE_RUNNING
    self.emit('started')

    self._run(function () {
        self.state = Runnable.STATE_COMPLETED

        if (self.errors.length > 0) {
            var suites = [this.parent]
              , error = new Error(self.full_title('/') + ' failed')

            while (suite = suites.pop()) {
                suite.allTests().forEach(function (test) {
                    if (test.skipped) {
                        return
                    }

                    test.errors.push(error)
                })
                suites = suites.concat(suite.suites)
            }
        }

        self.emit('completed')
        callback()
    })
}
