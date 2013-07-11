module.exports = parse;
module.exports.read = read;
module.exports.codegen = codegen;

function debug() {
  if (true) return;
  console.log.apply(null, arguments);
}

function parse (code) {
  if (typeof code !== 'string') code = code.toString();

  function match(exp){
    var m = exp.exec(code);
    if (!m) return;
    code = code.slice(m[0].length);
    return m;
  }

  function error(msg){
    throw new Error(msg + ' near ' + code.substr(0, 10));
  }

  function lparen(){
    var m = match(/^(\(|\[)\s*/);
    if (!m) return;
    debug('lparen %s', m[0]);
    return m;
  }

  function rparen(){
    var m = match(/^\)|\]\s*/);
    if (!m) return;
    debug('rparen %s', m[0]);
    return m;
  }

  function string(){
    var m = match(/^"([^"]+)"\s*/);
    if (!m) return;
    debug('string "%s"', m[1]);
    return m[1];
  }

  function number(){
    var m = match(/^([0-9]+)?\.?[0-9]+/);
    if (!m) return;
    debug('number %s', m[0]);
    return Number(m[0]);
  }

  function symbol(){
    var m = match(/^[^\s\)\(\[\]]+/);
    if (!m) return;
    debug('symbol %s', m[0]);
    return new Symbol(m[0]);
  }

  function atom(){
    return string() || number() || symbol();
  }

  function list(){
    if (!lparen()) return;
    var ret = [];
    var el;
    while(el = atom() || list()){
      ret.push(el);
      whitespace();
    }
    if (!rparen()) return error('expected ) or ]');
    return ret;
  }

  function lists(){
    var ret = [];
    while(el = list()){
      ret.push(el);
      whitespace();
    }
    return ret;
  }

  function whitespace(){
    match(/\s*/);
  }

  //return lists();
  return list();

}

function Symbol(name){
  this.name = name;
}

Symbol.prototype.toString = function(){
  return this.name;
};

function Environment(outer){
  if (outer) this.outer = outer;
  this.kv = {};
}

Environment.prototype.find = function (key) {
  if (this.kv[key]) return this;
  if (this.outer && this.outer.find(key)) return this.outer.find(key);
};

Environment.prototype.get = function (key) {
  return (this.find(key) || {kv:{}}).kv[key];
};

Environment.prototype.set = function (key, value) {
  (this.find(key) || this).kv[key] = value;
};

Environment.prototype.has = function (key) {
  return key in (this.find(key) || {kv:{}}).kv;
};

Environment.prototype.load = function (kv) {
  var self = this;
  Object.keys(kv).forEach(function (key) {
    self.set(key, kv[key]);
  });
  return self;
};

var native = {
  '+' : function (args) {
    args = Array.prototype.slice.apply(arguments);
    return args.slice(1).reduce(function (a, b) {
      return a + b;
    }, args[0]);
  },

  '-' : function (args) {
    args = Array.prototype.slice.apply(arguments);
    return args.slice(1).reduce(function (a, b) {
      return a - b;
    }, args[0]);
  },

  '<' : function (args) {
    args = Array.prototype.slice.apply(arguments);
    for (var i = 1; i < args.length; i++) {
      if (args[i-1] >= args[i]) return false;
    }
    return true;
  },

  '>' : function (args) {
    args = Array.prototype.slice.apply(arguments);
    for (var i = 1; i < args.length; i++) {
      if (args[i-1] <= args[i]) return false;
    }
    return true;
  }
};

function run(x, env) {
  if (!env) {
    env = new Environment();
    env.load(native).load(global);
    env.set('require', require);
  }

  if (x instanceof Symbol) return env.get(x.name);
  if (!Array.isArray(x)) return x;

  switch(x[0].name){
    case 'quote':
      x = x.slice(1)[0];
      return Array.isArray(x)
        ? x.map(function (s) { return s.toString() })
        : x.toString()

    case 'if':
      return run(x[1], env)
        ? run(x[2], env)
        : run(x[3], env);

    case 'def':
      return env.set(x[1], run(x[2], env));

    case 'fun':
      return function () {
        var args = Array.prototype.slice.apply(arguments);
        env = new Environment(env);
        x[1].forEach(function (key, i) {
          env.set(key.name, args[i]);
        });
        return x.slice(1).reduce(function (_, x) {
          return run(x, env);
        });
      };

    case 'set!':
      if (!env.has(x[1])) throw new Error('not found');
      var val = run(x[2], env);
      env.set(x[1], val);
      return val;

    case 'do':
      return x.reduce(function (_, x) {
        return run(x, env);
      });
  }

  if (x[0].name && x[0].name[0] === '.') {
    var obj = env.get(x.splice(1, 1)[0].name);
    var fn = x[0].name.slice(1);
    x[0] = obj[fn].bind(obj);
  }

  x = x.map(function (x) { return run(x, env); });
  if (typeof x[0] !== 'function') throw new Error(x[0] + ' is not a function');
  return x[0].apply(null, x.slice(1));
}

function codegen(x, indent) {
  if (typeof indent === 'undefined') indent = 0;

  function indented (str) {
    if (typeof str !== 'string') str = String(str);
    var space = new Array(indent).join(' ');
    return str.split('\n').map(function (str) {
      return space + str;
    }).join('\n');
  }

  if (x instanceof Symbol) return x.name;
  if (typeof x === 'string') return '"' + x + '"';
  if (!Array.isArray(x)) return x;

  switch (x[0].name) {
    case 'quote':
      x = x.slice(1).map(function (x) {
        return indented(codegen(x));
      });
      return x.length === 1
        ? x[0]
        : x;

    case 'if':
      return indented(codegen(x[1]) + '\n'
        + '  ? ' + indented(codegen(x[2])) + '\n'
        + '  : ' + indented(codegen(x[3])) + ';');

    case 'def':
      return 'var ' + x[1].name + ' = ' + indented(codegen(x[2]));

    case 'set!':
      return x[1].name + ' = ' + indented(codegen(x[2]));

    case 'fun':
      var out = 'function(';
      out += x[1]
        .map(function (x) {
          return x.name;
        })
        .join(', ');
      out += '){\n';
      x.slice(2).forEach(function (x, i) {
        var ret = i === x.length - 3
          ? 'return '
          : '';
        out += indented('  ' + ret + codegen(x));
      });
      out += '\n}';
      return out;

    case 'do':
      return '(function(){\n'
        + x.slice(1).reduce(function (acc, x, i) {
            var ret = i == x.length - 2
              ? 'return '
              : '';
            acc.push('  ' + ret + indented(codegen(x)) + ';');
            return acc;
          }, []).join('\n')
        + '\n})()';

  }

  if (x[0].name && x[0].name[0] === '.') {
    x[0] = new Symbol(x.splice(1, 1) + x[0]);
  }

  x = x.map(function (x) {
    var out = indented(codegen(x));
    if (Array.isArray(x)) out = '(' + out + ')';
    return out;
  });

  return Object.keys(native).indexOf(x[0]) === -1
    ? x[0] + '(' + x.slice(1).join(', ') + ')'
    : x.slice(1).join(' ' + x[0] + ' ');
}

function read(code) {
  return run(parse(code));
}
