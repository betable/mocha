/**
 * Module dependencies.
 */
var Base = require('./base')
  , utils = require('../utils')
  , escape = utils.escape
  , fs = require("fs")
  , filePath = process.env.XUNIT_FILE || process.cwd() + "/xunit.xml"
  , fd = fs.openSync(filePath, 'w', 0755)

/**
 * Save timer references to avoid Sinon interfering (see GH-237).
 */
var Date = global.Date
  , setTimeout = global.setTimeout
  , setInterval = global.setInterval
  , clearTimeout = global.clearTimeout
  , clearInterval = global.clearInterval

/**
 * Expose `XUnitFile`.
 */
exports = module.exports = XUnitFile

/**
 * Initialize a new `XUnitFile` reporter.
 *
 * @param {Runner} runner
 * @api public
 */
function XUnitFile(runner) {
    Base.call(this, runner)
    var self = this
      , stats = this.stats
      , tests = []

    runner.on('pass', function (test) {
        process.stdout.write('Passed: ' + test.fullTitle() + '\n')
        tests.push(test)
    })

    runner.on('fail', function (test) {
        process.stdout.write('Failed: ' + test.fullTitle() + '\n')
        tests.push(test)
    })

    runner.on('pending', function (test) {
        process.stdout.write('Skipped: ' + test.fullTitle() + '\n')
        tests.push(test)
    })

    runner.on('hook', function (test) {
        tests.push(test)
    })

    runner.on('end', function () {
        self.failures.forEach(function (test, i) {
            // msg
            var err = test.err

            console.error((i + 1) + ') ' + test.fullTitle())

            if (err.message) {
                console.error('   Error: ' + err.message)
            }

            if (err.stack) {
                console.error('   Stack trace:')
                err.stack.split('\n').forEach(function (line) {
                    console.error('        ' + line)
                })
            }

            console.error('')
        });

        appendLine(tag('testsuite', {
            name: 'Mocha Tests'
          , tests: stats.tests
          , failures: stats.failures
          , errors: stats.failures
          , skip: stats.tests - stats.failures - stats.passes
          , timestamp: (new Date).toUTCString()
          , time: (stats.duration > 1000) ? (stats.duration / 1000) : 0
        }, false))

        tests.forEach(test)
        appendLine('</testsuite>')
        fs.closeSync(fd)
    })
}

/**
 * Inherit from `Base.prototype`.
 */
XUnitFile.prototype.__proto__ = Base.prototype

/**
 * Output tag for the given `test.`
 */
function test(test) {
    var attrs = {
        classname: test.parent.fullTitle()
      , name: test.title
      , time: (test.duration > 1000) ? (test.duration / 1000) : 0
    }

    if ('failed' == test.state) {
        var err = test.err
        attrs.message = escape(err.message)
        appendLine(tag('testcase', attrs, false, tag('failure', attrs, false, cdata(err.stack))))

    } else if (test.pending) {
        delete attrs.time
        appendLine(tag('testcase', attrs, false, tag('skipped', {}, true)))

    } else {
        appendLine(tag('testcase', attrs, true))
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

function appendLine(line) {
    if (process.env.LOG_XUNIT) {
        console.log(line)
    }

    fs.writeSync(fd, line + "\n", null, 'utf8')
}
