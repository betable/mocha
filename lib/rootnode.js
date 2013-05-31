var Runnable = require('./runnable')

/**
 * Initialize a new RootNode with the given title and callback test function
 * RootNodes are internal nodes for noting the start and end of the entire test suite
 *
 * @param {Runnable} title Title of the root node
 * @param {Function} test_function Function to call when it is our turn
 *
 * @constructor
 * @extends Runnable
 * @private
 */
var RootNode = function (title, test_function) {
    Runnable.call(this, title, test_function)
    this.exclusive(true)
}

RootNode.prototype.__proto__ = Runnable.prototype
module.exports = RootNode

/**
 * Noop, emits done and calls the callback immediately
 *
 * @param {function} [callback] Nothing is provided to this callback
 */
RootNode.prototype.run = function (callback) {
    this.emit('completed')
    if (typeof callback === 'function') {
        callback()
    }
}
