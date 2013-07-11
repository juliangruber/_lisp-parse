var parse = require('./index');
var assert = require('assert');

var fixtures = [
  {
    input: '(+ 1 2)',
    output: '1 + 2',
    result: 3
  },
  {
    input: '(+ (- 3 2) 2)',
    output: '(3 - 2) + 2',
    result: 3
  },
  /*{
    input: '(quote (a b c))',
    output: '[ \'a\', \'b\', \'c\' ]',
    result: [ 'a', 'b', 'c' ]
  }*/,
  {
    input: '(if (< 10 20) (+ 1 1) (+ 3 3))',
    output: '10 < 20\n  ? 1 + 1\n  : 3 + 3;',
    result: 2
  },
  {
    input: '(quote "a string")',
    output: '"a string"',
    result: 'a string'
  },
  {
    input: '(+ "some strings" " are long")',
    output: '"some strings" + " are long"',
    result: 'some strings are long'
  },
  {
    input: '(def foo "bar")',
    output: 'var foo = "bar"',
    result: undefined
  },
  {
    input: '(do (+ 1 2) (+ 2 3))',
    output: '(function(){\n  1 + 2;\n  return 2 + 3;\n})()',
    result: 5
  },
  {
    input: '(do (def foo "bar") (set! foo "baz"))',
    output: '(function(){\n  var foo = "bar";\n  return foo = "baz";\n})()',
    result: "baz"
  },
  {
    input: '(do (def foo "foo") (+ foo "bar"))',
    output: '(function(){\n  var foo = "foo";\n  return foo + "bar";\n})()',
    result: 'foobar'
  },
  {
    input: '(require "http")',
    output: 'require("http")',
    result: require('http')
  },
  {
    input: '(def http (require "http"))',
    output: 'var http = require("http")',
    result: undefined
  },
  {
    input: '((fun [x] (+ x 1)) 1)',
    output: '(function(x){\n  return x + 1\n})(1)',
    result: 2
  },
  {
    input: '((fun [x] (def s x) (+ s 1)) 1)',
    output: '(function(x){\n  var s = x;\n  return s + 1;\n})(1)',
    result: 2
  },
  {
    input: '(.log console "foo")',
    output: 'console.log("foo")',
    result: undefined
  }
]

fixtures.forEach(function (fix) {
  console.log('input: %s', fix.input);
  console.log('parsed: %j', parse(fix.input));
  console.log('output: %s', parse.codegen(parse(fix.input)));
  console.log('result: %s', parse.read(fix.input));
  assert.deepEqual(parse.read(fix.input), fix.result);
  assert.deepEqual(parse.codegen(parse(fix.input)), fix.output);
  assert.deepEqual(
    eval(parse.codegen(parse(fix.input))),
    fix.result
  );
  console.log();
});
