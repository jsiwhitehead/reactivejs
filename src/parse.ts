import ohm from "ohm-js";

const grammar = String.raw`Maraca {

  start
    = space* value? space*

  function
    = "(" space* listOf<name, join> space* ")" space* "=>" space* value

  brackets
    = "(" space* items space* ")"

  object
    = "{" space* items space* "}"

  array
    = "[" space* items space* "]"

  items
    = listOf<(merge | assign | unpack | value), join> space* ","?

  join
    = space* "," space*

  merge
    = name space* "::" space* value?

  assign
    = key space* ":" space* value

  unpack
    = "..." space* value

  block<tag>
    = "<" tag space* listOf<(bmerge | bassign), space+> space* ">" bcontent* "</" tag ">"

  blockclosed<tag>
    = "<" tag space* listOf<(bmerge | bassign), space+> space* "/>"

  bmerge
    = key "::" (bvalue | string)?

  bassign
    = key "=" (bvalue | string)

  bcontent
    = (bchunk | bvalue | block<name> | blockclosed<name>)

  bvalue
    = "{" value "}"

  bchunk
    = bchar+

  bchar
    = ~("<" | "{") any

  value
    = (vchunk | function| brackets | object | array | block<name> | blockclosed<name>)+

  vchunk = vchar+

  vchar = ~("(" | ")" | "{" | "}" | "[" | "]" | "," | "=>" | open | "/>") any

  open
    = "<" name

  key
    = string
    | name

  name
    = (alnum | "-")+

  string
    = "\"" (schar | escape)* "\""

  schar
    = ~("\"" | "\\") any

  escape
    = "\\" any

}`;

const g = ohm.grammar(grammar);
const s = g.createSemantics();

s.addAttribute("ast", {
  start: (_1, a, _2) => a.ast[0],

  function: (_1, _2, a, _3, _4, _5, _6, _7, b) => ({
    type: "func",
    args: a.asIteration().children.map((c) => c.ast),
    body: b.ast,
  }),

  brackets: (_1, _2, a, _3, _4) => ({ type: "brackets", items: a.ast }),

  object: (_1, _2, a, _3, _4) => ({ type: "object", items: a.ast }),

  array: (_1, _2, a, _3, _4) => ({ type: "array", items: a.ast }),

  items: (a, _1, _2) => a.ast,

  join: (_1, _2, _3) => null,

  merge: (a, _1, _2, _3, b) => ({ type: "merge", key: a.ast, value: b.ast[0] }),

  assign: (a, _1, _2, _3, b) => ({ type: "assign", key: a.ast, value: b.ast }),

  unpack: (_1, _2, a) => ({ type: "unpack", value: a.ast }),

  block: (_1, a, _2, b, _3, _4, c, _5, _6, _7) => ({
    type: "block",
    tag: a.ast,
    items: [...b.ast, ...c.ast],
  }),

  blockclosed: (_1, a, _2, b, _3, _4) => ({
    type: "block",
    tag: a.ast,
    items: b.ast,
  }),

  bmerge: (a, _1, b) => ({ type: "merge", key: a.ast, value: b.ast[0] }),

  bassign: (a, _1, b) => ({ type: "assign", key: a.ast, value: b.ast }),

  bcontent: (a) => a.ast,

  bvalue: (_1, a, _2) => a.ast,

  bchunk: (a) => a.sourceString,

  bchar: (_) => null,

  value: (a) => a.ast,

  vchunk: (a) => a.sourceString,

  vchar: (_) => null,

  open: (_1, a) => a.ast,

  key: (a) => a.ast,

  name: (a) => a.sourceString,

  string: (_1, a, _2) => a.sourceString,

  schar: (_) => null,

  escape: (_1, a) => a.sourceString,

  listOf: (a) => a.ast,
  nonemptyListOf: (a, _1, b) => [a.ast, ...b.ast],
  emptyListOf: () => [],

  _iter: (...children) => children.map((c) => c.ast),
});

export default (script) => {
  const m = g.match(script);
  if (m.failed()) {
    console.error(m.message);
    throw new Error("Parser error");
  }
  return s(m).ast;
};
