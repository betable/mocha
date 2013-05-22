var Base = require('./base')
  , color = Base.color
  , Runnable = require('../runnable')

exports = module.exports = List

/**
 * Initialize a new `List` test reporter.
 *
 * @param {Runner} runner
 * @param {function} writer
 */
function List(runner, writer) {
    Base.call(this, runner, writer)

    var self = this
      , n = 0

    runner.on('start', function () {
        self.writer()
    })

    runner.on('test', function (test) {
        test._slow_interval = setInterval(function () {
            if (typeof test.state === Runnable.STATE_COMPLETED) {
                return clearInterval(test._slow_interval)
            }

            self.writer(
                'Running:', test.full_title('/'),
                'Timeout:', test.timeout(),
                'Running for:' + (Date.now() - test.start)
            )

        }, 10000)
    })

    runner.on('skipped', function (test) {
        clearInterval(test._slow_interval)
        var fmt = color('checkmark', '  -') + color('skipped', ' %s')
        self.writer(fmt, test.full_title('/'))
    })

    runner.on('pass', function(test) {
        clearInterval(test._slow_interval)
        var fmt = color('checkmark', '  ' + Base.symbols.dot) + color('pass', ' %s: ') + color(test.speed, '%dms')
        self.writer(fmt, test.full_title('/'), test.duration)
    })

    runner.on('fail', function (test, err) {
        clearInterval(test._slow_interval)
        self.writer(color('fail', '  %d) %s'), ++n, test.full_title('/'))
        self.writer(color('error message', '       %s'), test.errors[0])
    })

    runner.on('end', function () {
        self.epilogue()
    })
}

List.prototype.__proto__ = Base.prototype
