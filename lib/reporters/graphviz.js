var Base = require('./base')
  , Test = require('../Test')
  , RootNode = require('../RootNode')

var GraphViz = function (runner, writer) {
    Base.call(this, runner, writer)
    var self = this

    self.subgraphs = []

    runner.on('start', function () {
        writer('digraph G {')
        self.print_nodes()
        self.print_subgraphs()
        self.print_edges()
        writer('}')
    })
}

GraphViz.prototype.__proto__ = Base.prototype

module.exports = GraphViz

GraphViz.prototype.print_nodes = function () {
    var self = this
      , node_id = 1
      , color = ''
      , line = ''
      , subgraph_id = 1

    self.runner.all_tests.forEach(function (test) {
        test.node_id = 'node' + (node_id++)

        if (test.skipped) {
            color = 'azure4'

        } else if (test.exclusive()) {
            if (test instanceof RootNode) {
                color = 'blue'
            } else {
                color = 'red'
            }
        } else {
            color = 'white'
        }

        var all_rows = []
        if (test instanceof Test) {
            test.allBeforeEach().forEach(function (hook) {
                all_rows.push(hook.full_title('/'))
            })

            all_rows.push(test.title)

            test.allAfterEach().forEach(function (hook) {
                all_rows.push(hook.full_title('/'))
            })
        } else {
            all_rows.push(test.title)
        }

        line = '    ' + test.node_id + ' [shape=record' +
            ', label="{' + all_rows.join('|') + '}"' +
            ', style=filled, fillcolor=' + color + '];'

        self.writer(line)

        if (test.parent) {
            if (!test.parent.subgraph_id) {
                test.parent.subgraph_id = subgraph_id++
                self.subgraphs[test.parent.subgraph_id] = {
                    id: test.parent.subgraph_id
                    , label: test.parent.full_title('/')
                    , tests: []
                }
            }

            self.subgraphs[test.parent.subgraph_id].tests.push(test)
        }
    })

    self.writer()
}

GraphViz.prototype.print_subgraphs = function () {
    var self = this
      , line = ''

    self.subgraphs.forEach(function (subgraph) {
        line = '    subgraph cluster_' + subgraph.id + ' {\n'
        line += '        label="' + subgraph.label + '";\n'
        line += '        graph[style=dotted];'

        self.writer(line + '\n')

        subgraph.tests.forEach(function (test) {
            self.writer('        ' + test.node_id + ';')
        })

        self.writer('    }')
    })

    self.writer()
}

GraphViz.prototype.print_edges = function () {
    var self = this

    self.runner.all_tests.forEach(function (test) {
        test._dependencies.forEach(function (pre_test) {
            self.writer('    ' + pre_test.node_id + ' -> ' + test.node_id + ';')
        })
    })
}
