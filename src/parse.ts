import ohm from "ohm-js";

import compileCode from "./code";

const grammar = String.raw`Maraca {

  start
    = space* value? space*

  function
    = "(" space* listOf<name, join> space* ")" space* "=>" space* value

  functionsingle
    = name space* "=>" space* value

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
    = "~"? space* name space* "::" space* value?

  assign
    = "*"? space* key space* ":" space* value

  unpack
    = "..." space* value

  plainblock
    = "<\\" space* listOf<(bmerge | bassign | btrue | bunpack | bvalue), space+> space* ">" bcontent* "</>"

  block<tag>
    = "<" tag space* listOf<(bmerge | bassign | btrue | bunpack | bvalue), space+> space* ">" bcontent* "</" tag ">"

  plainblockclosed
    = "<\\" space* listOf<(bmerge | bassign | btrue | bunpack | bvalue), space+> space* "/>"

  blockclosed<tag>
    = "<" tag space* listOf<(bmerge | bassign | btrue | bunpack | bvalue), space+> space* "/>"

  bmerge
    = "~"? key "::" (bvalue | string)?

  bassign
    = "*"? key "=" (bvalue | string)

  btrue
    = name

  bcontent
    = (bchunk | bunpack | bvalue | plainblock | block<name> | plainblockclosed | blockclosed<name>)

  bunpack
    = "{" "..." value "}"

  bvalue
    = "{" value "}"

  bchunk
    = bchar+

  bchar
    = ~("<" | "{") any

  value
    = (function| functionsingle | vchunk | xstring | ystring | template | brackets | object | array | plainblock | block<name> | plainblockclosed | blockclosed<name>)+

  vchunk
    = vchar+

  vchar = ~("(" | ")" | "{" | "}" | "[" | "]" | "," | "=>" | open | "<\\" | "/>" | "\"" | "'" | "${"`"}") any

  xstring
    = "\"" (xchar | escape)* "\""

  xchar
    = ~("\"" | "\\") any

  ystring
    = "'" (ychar | escape)* "'"

  ychar
    = ~("'" | "\\") any

  template
    = "${"`"}" (tchunk | tvalue)* "${"`"}"

  tvalue
    = "${"${"}" value "}"

  tchunk
    = (tchar | escape)+

  tchar
    = ~("${"`"}" | "\\" | "${"${"}") any

  open
    = "<" name

  key
    = string
    | name

  name
    = (alnum | "-" | "_")+

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

  functionsingle: (a, _1, _2, _3, b) => ({
    type: "func",
    args: a.ast,
    body: b.ast,
  }),

  brackets: (_1, _2, a, _3, _4) => ({ type: "brackets", items: a.ast }),

  object: (_1, _2, a, _3, _4) => ({ type: "object", items: a.ast }),

  array: (_1, _2, a, _3, _4) => ({ type: "array", items: a.ast }),

  items: (a, _1, _2) => a.ast,

  join: (_1, _2, _3) => null,

  merge: (a, _1, b, _2, _3, _4, c) => ({
    type: "merge",
    source: a.ast.length === 1,
    key: b.ast,
    value: c.ast[0],
  }),

  assign: (a, _1, b, _2, _3, _4, c) => ({
    type: "assign",
    recursive: a.ast.length === 1,
    key: b.ast,
    value: c.ast,
  }),

  unpack: (_1, _2, a) => ({ type: "unpack", value: a.ast }),

  plainblock: (_1, _2, a, _3, _4, b, _5) => ({
    type: "block",
    items: [...a.ast, ...b.ast],
  }),

  block: (_1, a, _2, b, _3, _4, c, _5, _6, _7) => ({
    type: "block",
    tag: a.ast,
    items: [...b.ast, ...c.ast],
  }),

  plainblockclosed: (_1, _2, a, _3, _4) => ({
    type: "block",
    items: a.ast,
  }),

  blockclosed: (_1, a, _2, b, _3, _4) => ({
    type: "block",
    tag: a.ast,
    items: b.ast,
  }),

  bmerge: (a, b, _1, c) => ({
    type: "merge",
    source: a.ast.length === 1,
    key: b.ast,
    value: c.ast[0],
  }),

  bassign: (a, b, _1, c) => ({
    type: "assign",
    recursive: a.ast.length === 1,
    key: b.ast,
    value: c.ast,
  }),

  btrue: (a) => ({
    type: "assign",
    key: a.ast,
    value: { type: "value", values: [], vars: [], run: () => true },
  }),

  bcontent: (a) => a.ast,

  bunpack: (_1, _2, a, _3) => ({ type: "unpack", value: a.ast }),

  bvalue: (_1, a, _2) => a.ast,

  bchunk: (a) => a.sourceString,

  bchar: (_) => null,

  value: (a) => {
    const ast = a.ast;
    const result = [ast[0]];
    for (let i = 1; i < ast.length; i++) {
      if (
        (typeof ast[i - 1] !== "string" || /[^\s!-]$/.test(ast[i - 1])) &&
        typeof ast[i] === "object" &&
        ["brackets", "array"].includes(ast[i].type)
      ) {
        if (ast[i].type === "brackets") {
          result.push("(...", { ...ast[i], type: "array" }, ")");
        } else {
          result.push("[", ast[i].items[0], "]");
        }
      } else {
        result.push(ast[i]);
      }
    }
    const values = [] as any[];
    const code = result
      .map((v) => (typeof v === "string" ? v : `$${values.push(v) - 1}`))
      .join("");
    return { type: "value", values, ...compileCode(code) };
  },

  vchunk: (a) => a.sourceString,

  vchar: (_) => null,

  xstring: (_1, a, _2) => `"${a.sourceString}"`,

  xchar: (_) => null,

  ystring: (_1, a, _2) => `'${a.sourceString}'`,

  ychar: (_) => null,

  template: (_1, a, _2) => {
    const values = [] as any[];
    const code = `\`${a.ast
      .map((v) => (typeof v === "string" ? v : `\${$${values.push(v) - 1}}`))
      .join("")}\``;
    return { type: "value", values, ...compileCode(code) };
  },

  tvalue: (_1, a, _2) => a.ast,

  tchunk: (a) => a.sourceString,

  tchar: (_) => null,

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
  _terminal: () => null,
});

export default (script) => {
  const m = g.match(script);
  if (m.failed()) {
    console.error(m.message);
    throw new Error("Parser error");
  }
  return s(m).ast;
};
