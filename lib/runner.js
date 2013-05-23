
/**
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter
  , debug = require('debug')('mocha:runner')
  , Test = require('./test')
  , Runnable = require('./test')
  , utils = require('./utils')
  , filter = utils.filter
  , keys = utils.keys;

/**
 * Non-enumerable globals.
 */

var globals = [
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'XMLHttpRequest',
  'Date'
];

/**
 * Expose `Runner`.
 */

module.exports = Runner;

/**
 * Initialize a `Runner` for the given `suite`.
 *
 * Events:
 *
 *   - `start`  execution started
 *   - `end`  execution complete
 *   - `suite`  (suite) test suite execution started
 *   - `suite end`  (suite) all tests (and sub-suites) have finished
 *   - `test`  (test) test execution started
 *   - `test end`  (test) test completed
 *   - `hook`  (hook) hook execution started
 *   - `hook end`  (hook) hook complete
 *   - `pass`  (test) test passed
 *   - `fail`  (test, err) test failed
 *
 * @api public
 */

function Runner(suite) {
  var self = this;
  this._globals = [];
  this.suite = suite;
  this.total = suite.total();
  this.failures = 0;
  this.on('test end', function(test){ self.checkGlobals(test); });
  this.on('hook end', function(hook){ self.checkGlobals(hook); });
  this.grep(/.*/);
  this.globals(this.globalProps().concat(['errno']));
}

/**
 * Wrapper for setImmediate, process.nextTick, or browser polyfill.
 *
 * @param {Function} fn
 * @api private
 */

Runner.immediately = global.setImmediate || process.nextTick;

/**
 * Inherit from `EventEmitter.prototype`.
 */

Runner.prototype.__proto__ = EventEmitter.prototype;

/**
 * Run tests with full titles matching `re`. Updates runner.total
 * with number of tests matched.
 *
 * @param {RegExp} re
 * @param {Boolean} invert
 * @return {Runner} for chaining
 * @api public
 */

Runner.prototype.grep = function(re, invert){
  debug('grep %s', re);
  this._grep = re;
  this._invert = invert;
  this.total = this.grepTotal(this.suite);
  return this;
};

/**
 * Returns the number of tests matching the grep search for the
 * given suite.
 *
 * @param {Suite} suite
 * @return {Number}
 * @api public
 */

Runner.prototype.grepTotal = function(suite) {
  var self = this;
  var total = 0;

  suite.eachTest(function(test){
    var match = self._grep.test(test.fullTitle());
    if (self._invert) match = !match;
    if (match) total++;
  });

  return total;
};

/**
 * Return a list of global properties.
 *
 * @return {Array}
 * @api private
 */

Runner.prototype.globalProps = function() {
  var props = utils.keys(global);

  // non-enumerables
  for (var i = 0; i < globals.length; ++i) {
    if (~utils.indexOf(props, globals[i])) continue;
    props.push(globals[i]);
  }

  return props;
};

/**
 * Allow the given `arr` of globals.
 *
 * @param {Array} arr
 * @return {Runner} for chaining
 * @api public
 */

Runner.prototype.globals = function(arr){
  if (0 == arguments.length) return this._globals;
  debug('globals %j', arr);
  utils.forEach(arr, function(arr){
    this._globals.push(arr);
  }, this);
  return this;
};

/**
 * Check for global variable leaks.
 *
 * @api private
 */

Runner.prototype.checkGlobals = function(test){
  if (this.ignoreLeaks) return;
  var ok = this._globals;
  var globals = this.globalProps();
  var isNode = process.kill;
  var leaks;

  // check length - 2 ('errno' and 'location' globals)
  if (isNode && 1 == ok.length - globals.length) return
  else if (2 == ok.length - globals.length) return;

  leaks = filterLeaks(ok, globals);
  this._globals = this._globals.concat(leaks);

  if (leaks.length > 1) {
    this.fail(test, new Error('global leaks detected: ' + leaks.join(', ') + ''));
  } else if (leaks.length) {
    this.fail(test, new Error('global leak detected: ' + leaks[0]));
  }
};

/**
 * Fail the given `test`.
 *
 * @param {Test} test
 * @param {Error} err
 * @api private
 */

Runner.prototype.fail = function(test, err){
  ++this.failures;
  test.state = 'failed';

  if ('string' == typeof err) {
    err = new Error('the string "' + err + '" was thrown, throw an Error :)');
  }

  this.emit('fail', test, err);
};

/**
 * Fail the given `hook` with `err`.
 *
 * Hook failures should emit a `fail`
 * and `hook end`.
 * Subsequent tests in the current suite
 * will not be run.
 *
 * @param {Hook} hook
 * @param {Error} err
 * @api private
 */

Runner.prototype.failHook = function(hook, err){
  this.fail(hook, err);
  //This is a bad attempt at skipping children suites of the suite containing the failed hook
  this.suites = [];
  this.emit('hook end', hook);
};

/**
 * Run hook `name` callbacks and then invoke `fn()`.
 *
 * @param {String} name
 * @param {Function} function
 * @api private
 */

Runner.prototype.hook = function(name, fn){
  var suite = this.suite
    , hooks = suite['_' + name]
    , self = this
    , timer;

  function next(i) {
    var hook = hooks[i];
    if (!hook) return fn();
    self.currentRunnable = hook;

    self.emit('hook', hook);

    hook.on('error', function(err){
      self.failHook(hook, err);
      return fn(err);
    });

    hook.run(function(err){
      hook.removeAllListeners('error');
      var testError = hook.error();
      if (testError) self.fail(self.test, testError);
      if (err) {
        self.failHook(hook, err);
        return fn(err);
      }
      self.emit('hook end', hook);
      next(++i);
    });
  }

  Runner.immediately(function(){
    next(0);
  });
};

/**
 * Run hook `name` for the given array of `suites`
 * in order, and callback `fn(err)`.
 *
 * @param {String} name
 * @param {Array} suites
 * @param {Function} fn
 * @api private
 */

Runner.prototype.hooks = function(name, suites, fn){
  var self = this
    , orig = this.suite;

  function next(suite) {
    self.suite = suite;

    if (!suite) {
      self.suite = orig;
      return fn();
    }

    self.hook(name, function(err){
      if (err) {
        self.suite = orig;
        return fn(err);
      }

      next(suites.pop());
    });
  }

  next(suites.pop());
};

/**
 * Run hooks from the top level down.
 *
 * @param {String} name
 * @param {Function} fn
 * @api private
 */

Runner.prototype.hookUp = function(name, fn){
  var suites = [this.suite].concat(this.parents()).reverse();
  this.hooks(name, suites, fn);
};

/**
 * Run hooks from the bottom up.
 *
 * @param {String} name
 * @param {Function} fn
 * @api private
 */

Runner.prototype.hookDown = function(name, fn){
  var suites = [this.suite].concat(this.parents());
  this.hooks(name, suites, fn);
};

/**
 * Return an array of parent Suites from
 * closest to furthest.
 *
 * @return {Array}
 * @api private
 */

Runner.prototype.parents = function(){
  var suite = this.suite
    , suites = [];
  while (suite = suite.parent) suites.push(suite);
  return suites;
};

/**
 * Handle uncaught exceptions.
 *
 * @param {Error} err
 * @api private
 */

Runner.prototype.uncaught = function(err){
  debug('uncaught exception %s', err.message);
  var runnable = this.currentRunnable;
  if (!runnable || 'failed' == runnable.state) return;
  runnable.clearTimeout();
  err.uncaught = true;
  this.fail(runnable, err);

  // recover from test
  if ('test' == runnable.type) {
    this.emit('test end', runnable);
    this.hookUp('afterEach', this.next);
    return;
  }

  // bail on hooks
  this.emit('end');
};

/**
 * Run the root suite and invoke `fn(failures)`
 * on completion.
 *
 * @param {Function} fn
 * @return {Runner} for chaining
 * @api public
 */

Runner.prototype.run = function(fn) {
    var self = this
      , root_node = new Runnable('root', function () {})
      , final_node = new Runnable('Final node', function () {})

    fn = fn || function () {}

    debug('start')

    // callback
    self.on('end', function () {
        debug('end')
        fn(self.failures)
    })

    // run suites
    self.emit('start')
    self.all_tests = [root_node]
    self._setup_dependencies(root_node, [this.suite])

    //Connect all edges to the final node
    final_node.add_dependencies(self._get_edges())

    final_node.on('completed', function () {
        self.emit('end')
    })
    self.all_tests.push(final_node)

    self.print_dot_graph()

    root_node.run()

    return this
};

Runner.prototype._setup_dependencies = function (root_node, suite_queue) {
    var self = this
      , suite_level = 0
      , final_suites = []
      , next_suite_queue = []
      , exclusives = []

    do {
        final_suites[suite_level] = []
        exclusives = []

        while (suite_queue.length > 0) {
            var sub_suite = suite_queue.shift()

            if (sub_suite.exclusive()) {
                exclusives.push(sub_suite)
            } else {
                final_suites[suite_level].push(sub_suite)
                next_suite_queue.push.apply(next_suite_queue, sub_suite.suites)
            }
        }

        self._walk_tests(root_node, final_suites[suite_level])
        suite_level++
        suite_queue = next_suite_queue
        next_suite_queue = []

        exclusives.forEach(function (exclusive_suite) {
            var wait_node = new Runnable('Wait node for EX ' + exclusive_suite.fullTitle(), function () {})
            wait_node.add_dependencies(self._get_edges())
            self.all_tests.push(wait_node)

            self._walk_tests(wait_node, [exclusive_suite])
            self._setup_dependencies(wait_node, exclusive_suite.suites)

            root_node = new Runnable('Final node for EX ' + exclusive_suite.fullTitle(), function () {})
            root_node.add_dependencies(self._get_edges())
            self.all_tests.push(root_node)


        })

    } while (suite_queue.length > 0)
}

Runner.prototype._walk_tests = function (root_node, suite_graph) {
    var self = this
      , max_tests = 0
      , exclusives = []

    suite_graph.forEach(function (suite) {
        suite.all_tests = suite._beforeAll.concat(suite.tests, suite._afterAll)
        max_tests = Math.max(max_tests, suite.all_tests.length)
    })

    //TODO: Support exclusive suites
    for (var i = 0; i < max_tests; i++) {
        exclusives = []

        suite_graph.forEach(function (suite) {
            var test = suite.all_tests[i]
            if (!test) {
                return
            }

            if (!test.parent.next_dependency) {
                test.parent.next_dependency = [root_node]//test.parent.parent.next_dependency || [root_node]
            }

            self._setup_test_hooks(test)

            //Put exclusive tests at the end
            if (test.exclusive()) {
                return exclusives.push(test)
            } else {
                test.add_dependencies(test.parent.next_dependency)
                test.parent.next_dependency = [test]
            }

            self.all_tests.push(test)
        })

        //TODO: Need to dedupe any dependencies to reduce memory footprint
        exclusives.forEach(function (test) {
            test.add_dependencies(self._get_edges())
            self.all_tests.push(test)

            suite_graph.forEach(function (suite) {
                suite.next_dependency = [test]
            })
        })
    }
}

Runner.prototype._get_edges = function () {
    var edges = []

    //TODO: We can do better than brute forcing it
    this.all_tests.forEach(function (test) {
        if (test.dependants.length) {
            return
        }

        edges.push(test)
    })

    return edges
}

Runner.prototype.print_dot_graph = function () {
    console.log('digraph G')
    console.log('{')
    this.all_tests.forEach(function (test) {
        test._dependencies.forEach(function (pre_test) {
            console.log('"' + test.fullTitle() + '"','->','"'+pre_test.fullTitle()+'";')
        })
    })
    console.log('}')
}

Runner.prototype._setup_test_hooks = function (test) {
    //TODO: Not all events are wired up!
    //TODO: put test events onto suite and capture suite events
    var self = this
    test.on('started', function () {
        //console.log('********************* STARTED', test.fullTitle())
        self.emit('test', test)
    })

    test.on('completed', function () {
        if (test.err) {
            //console.log('********************* FAILED', test.fullTitle())
            //console.log(test.err.stack)
            self.emit('fail', test, test.err)
        } else {
            //console.log('********************* COMPLETED', test.fullTitle())
            self.emit('pass', test)
        }

        self.emit('test end', test)
    })

    test.on('error', function (error) {
        console.log('************ ERROR', test.fullTitle(), error)
    })
}

/**
 * Filter leaks with the given globals flagged as `ok`.
 *
 * @param {Array} ok
 * @param {Array} globals
 * @return {Array}
 * @api private
 */

function filterLeaks(ok, globals) {
  return filter(globals, function(key){
    var matched = filter(ok, function(ok){
      if (~ok.indexOf('*')) return 0 == key.indexOf(ok.split('*')[0]);
      // Opera and IE expose global variables for HTML element IDs (issue #243)
      if (/^mocha-/.test(key)) return true;
      return key == ok;
    });
    return matched.length == 0 && (!global.navigator || 'onerror' !== key);
  });
}
