var Suite = require('../Suite')
  , Test = require('../Test')
  , SuiteHook = require('../SuiteHook')
  , TestHook = require('../TestHook')

/**
* BDD-style interface:
*
*      describe('Array', function(){
*        describe('#indexOf()', function(){
*          it('should return -1 when not present', function(){
*
*          })
*
*          it('should return the index when present', function(){
*
*          })
*        })
*      })
*
*/
module.exports = function (suite) {
    var suites = [suite]

    suite.on('pre-require', function (context, file, mocha) {
        /**
         * Execute before running tests.
         *
         * @return {SuiteHook} the beforeAll hook for chaining
         */
        context.before = function(fn){
            suites[0].beforeAll(fn)
            return suites[0]._beforeAll.slice(-1)[0] || new SuiteHook()
        }

        /**
         * Execute after running tests.
         *
         * @return {SuiteHook} the afterAll hook for chaining
         */
        context.after = function(fn){
            suites[0].afterAll(fn)
            return suites[0]._afterAll.slice(-1)[0] || new SuiteHook()
        }

        /**
         * Execute before each test case.
         *
         * @return {TestHook} the beforeEach hook for chaining
         */
        context.beforeEach = function(fn){
            suites[0].beforeEach(fn)
            return suites[0]._beforeEach.slice(-1)[0] || new TestHook()
        }

        /**
         * Execute after each test case.
         *
         * @return {TestHook} the afterEach hook for chaining
         */
        context.afterEach = function (fn) {
            suites[0].afterEach(fn)
            return suites[0]._afterEach.slice(-1)[0] || new TestHook()
        }

        /**
         * Describe a "suite" with the given `title` and callback `fn` containing nested suites and/or tests.
         *
         * @param {String} title The suites title
         * @param {function} fn Function to execute to build nested suites or tests
         *
         * @return {Suite} The suite that was created for chaining
         */
        context.describe = context.context = function (title, fn) {
            var suite = new Suite(title, suites[0])
            suites.unshift(suite)
            fn.call(suite)
            suites.shift()
            return suite
        }

        /**
         * Describe a skipped suite
         * No tests will be run in a skipped suite
         *
         * @param {String} title The suites title
         * @param {function} fn Function to execute to build nested suites or tests
         *
         * @return {Suite} The suite that was created for chaining
         */
        context.xdescribe = context.xcontext = context.describe.skip = function (title, fn) {
            var suite = new Suite(title, suites[0])
            suite.skipped = true
            suites.unshift(suite)
            fn.call(suite)
            suites.shift()
            return suite
        }

        /**
         * Exclusive suite.
         */
        context.describe.only = function (title, fn) {
            var suite = context.describe(title, fn)
            //TODO: fix only
            return suite
        }

        /**
         * Describe a specification or test-case
         * with the given `title` and callback `fn`
         * acting as a thunk.
         */
        context.it = context.specify = function (title, fn) {
            var suite = suites[0]
            var test = new Test(title, fn)
            suite.addTest(test)
            return test
        }

        /**
         * Exclusive test-case.
         */
        context.it.only = function (title, fn) {
            var test = context.it(title, fn)
            //TODO: fix only
            return test
        }

        /**
         * Skipped test case.
         */
        context.xit = context.xspecify = context.it.skip = function (title) {
            context.it(title)
        }
    })
}
