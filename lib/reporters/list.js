var Base = require('./base')
  , cursor = Base.cursor
  , color = Base.color
    , Runnable = require('../Runnable')

exports = module.exports = List

/**
* Initialize a new `List` test reporter.
*
* @param {Runner} runner
* @api public
*/
function List(runner) {
    Base.call(this, runner)

    var self = this
      , n = 0

    runner.on('start', function () {
        console.log()
    })

    runner.on('test', function (test) {
        test._slow_interval = setInterval(function () {
            if (typeof test.run_state === Runnable.STATE_COMPLETED) {
                return clearInterval(test._slow_interval)
            }

            console.log(
                'Running:', test.fullTitle('/'),
                'Timeout:', test.timeout(),
                'Running for:' + (Date.now() - test.start)
            )

        }, 10000)
    })

    runner.on('skipped', function (test) {
        clearInterval(test._slow_interval)
        var fmt = color('checkmark', '  -') + color('skipped', ' %s')
        console.log(fmt, test.fullTitle('/'))
    })

    runner.on('pass', function(test) {
        clearInterval(test._slow_interval)
        var fmt = color('checkmark', '  ' + Base.symbols.dot) + color('pass', ' %s: ') + color(test.speed, '%dms')
        console.log(fmt, test.fullTitle('/'), test.duration)
    })

    runner.on('fail', function (test, err) {
        clearInterval(test._slow_interval)
        console.log(color('fail', '  %d) %s'), ++n, test.fullTitle('/'))
        console.log(color('error message', '       %s'), test.errors[0])
    })

    runner.on('end', function () {
        self.epilogue()
    })
}

List.prototype.__proto__ = Base.prototype;
