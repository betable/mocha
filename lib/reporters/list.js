var Base = require('./base')
  , cursor = Base.cursor
  , color = Base.color

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
/*
    runner.on('test', function (test) {
        if (test.timeout() > 1000) {
            test._slow_interval = setInterval(function () {
                if (typeof test.duration !== 'undefined') {
                    return clearInterval(test._slow_interval)
                }

                console.log('Running: ' + test.fullTitle() + ' ' + test.node_id)
            }, 2000)
        }
    })
*/
    runner.on('pending', function (test) {
        var fmt = color('checkmark', '  -') + color('pending', ' %s')
        console.log(fmt, test.fullTitle())
    })

    runner.on('pass', function(test) {
        var fmt = color('checkmark', '  ' + Base.symbols.dot) + color('pass', ' %s: ') + color(test.speed, '%dms')
        console.log(fmt, test.fullTitle(), test.duration)
    })

    runner.on('fail', function (test, err) {
        console.log(color('fail', '  %d) %s'), ++n, test.fullTitle())
    })

    runner.on('end', function () {
        self.epilogue()
    })
}

List.prototype.__proto__ = Base.prototype;
