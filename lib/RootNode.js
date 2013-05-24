var Runnable = require('./runnable');

/**
 * Initialize a new `RootNode` with the given `title` and callback `fn`.
 *
 * @param {Runnable} title Title of the root node
 * @param {Function} fn Function to call when it is our turn
 *
 * @constructor
 * @extends Runnable
 */
var RootNode = function (title, fn) {
    Runnable.call(this, title, fn)
    this.type = 'root_node'
    this.exclusive(true)
}

RootNode.prototype.__proto__ = Runnable.prototype

module.exports = RootNode;

/**
 * Noop, emits done and calls the callback immediately
 *
 * @param {function} callback Nothing is provided to this callback
 */
RootNode.prototype.run = function (callback) {
    this.emit('completed', this)
    if (typeof callback === 'function') {
        callback()
    }
}
