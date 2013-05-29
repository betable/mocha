var Runnable = require('./runnable');

/**
 * Initialize a new Hook with the given title and callback function
 *
 * @param {String} title Title of this hook
 * @param {function} hook_function Function to run for this hook
 *
 * @constructor
 */
var Hook = function (title, hook_function) {
    Runnable.call(this, title, hook_function)
    this.type = 'hook'
}

module.exports = Hook

Hook.prototype.__proto__ = Runnable.prototype

Hook.prototype.complete = function (error) {
    Runnable.prototype.complete.call(this, error)
}
