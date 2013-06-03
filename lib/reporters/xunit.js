var Base = require('./base')
  , utils = require('../utils')
  , Runnable = require('../runnable')
  , escape = utils.escape

/**
 * Save timer references to avoid Sinon interfering (see GH-237).
 */
var Date = global.Date
  , setTimeout = global.setTimeout
  , setInterval = global.setInterval
  , clearTimeout = global.clearTimeout
  , clearInterval = global.clearInterval

exports = module.exports = XUnit

/**
 * Initialize a new `XUnit` reporter.
 * This reporter outputs xunit compatible xml
 *
 * @param {Runner} runner The object running the suites
 * @param {function} writer The writer function to use for reporter output
 *
 * @constructor
 */
function XUnit(runner, writer) {
    Base.call(this, runner, writer)

    var self = this
      , stats = this.stats
      , tests = []

    runner.on('test end', function (test) {
        tests.push(test)
    })

    runner.on('hook', function (test) {
        tests.push(test)
    })

    runner.on('end', function () {
        writer(
            tag(
                'testsuite'
                , {
                    name: 'Mocha Tests'
                  , tests: stats.tests
                  , failures: stats.failures
                  , errors: stats.failures
                  , skip: stats.tests - stats.failures - stats.passes
                  , timestamp: (new Date).toUTCString()
                  , time: (stats.duration > 0) ? (stats.duration / 1000) : 0
                }
              , false
            )
        )

        tests.forEach(function (test) { self.test(test) })

        writer('</testsuite>')
    })
}

/**
 * Inherit from `Base.prototype`.
 */
XUnit.prototype.__proto__ = Base.prototype

/**
 * Output tag for the given `test.`
 */
XUnit.prototype.test = function (test) {
    var names = getNames(test)
      , attrs = {
            classname: names.class
          , name: names.test
          , time: (test.duration > 0) ? (test.duration / 1000) : 0
        }

    if (test.errors.length) {
        var err = test.errors[0]
        attrs.message = escape(err.message)
        this.writer(tag('testcase', attrs, false, tag('failure', attrs, false, cdata(err.stack))))

    } else if (test.skipped) {
        delete attrs.time
        this.writer(tag('testcase', attrs, false, tag('skipped', {}, true)))

    } else {
        this.writer(tag('testcase', attrs, true))
    }
}

/**
 * HTML tag helper.
 */
function tag(name, attrs, close, content) {
    var end = close ? '/>' : '>'
        , pairs = []
        , tag

    for (var key in attrs) {
        pairs.push(key + '="' + escape(attrs[key]) + '"')
    }

    tag = '<' + name + (pairs.length ? ' ' + pairs.join(' ') : '') + end
    if (content) {
        tag += content + '</' + name + end
    }

    return tag
}

/**
 * Return cdata escaped CDATA `str`.
 */
function cdata(str) {
    return '<![CDATA[' + escape(str) + ']]>'
}

function getNames(test) {
    var names = []
        , temp = test

    do {
        if (!temp.title) {
            continue
        }

        names.unshift(temp.title)
    } while (temp = temp.parent)

    return {
        class: names[0]
        , test: names.slice(1).join('/')
    }
}
