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
    = "(" "~"? space* items space* ")"

  object
    = "{" "~"? space* items space* "}"

  array
    = "[" "~"? space* items space* "]"

  items
    = listOf<(merge | assign | unpack | value), join> space* ","?

  join
    = space* "," space*

  merge
    = name space* "::" space* value

  assign
    = ("*" | "&")? space* key space* (":~" | ":") space* value

  unpack
    = "..." space* value

  plainblock
    = "<\\" "~"? space* listOf<(bmerge | bassign | btrue | bunpack | bvalue), space+> space* ">" bcontent* "</>"

  block<tag>
    = "<" tag space* listOf<(bmerge | bassign | btrue | bunpack | bvalue), space+> space* ">" bcontent* "</" tag ">"

  plainblockclosed
    = "<\\" "~"? space* listOf<(bmerge | bassign | btrue | bunpack | bvalue), space+> space* "/>"

  blockclosed<tag>
    = "<" tag space* listOf<(bmerge | bassign | btrue | bunpack | bvalue), space+> space* "/>"

  bmerge
    = key "::" (bvalue | string)

  bassign
    = ("*" | "&")? key (":~" | "=") (bvalue | string)

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
    = (function | functionsingle | vchunk | xstring | ystring | template | brackets | object | array | plainblock | block<name> | plainblockclosed | blockclosed<name>)+

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
    args: a.ast,
    body: b.ast,
  }),

  functionsingle: (a, _1, _2, _3, b) => ({
    type: "func",
    args: [a.ast],
    body: b.ast,
  }),

  brackets: (_1, a, _2, b, _3, _4) => ({
    type: "brackets",
    items: b.ast,
    capture: a.sourceString === "~",
  }),

  object: (_1, a, _2, b, _3, _4) => ({
    type: "object",
    items: b.ast,
    capture: a.sourceString === "~",
  }),

  array: (_1, a, _2, b, _3, _4) => ({
    type: "array",
    items: b.ast,
    capture: a.sourceString === "~",
  }),

  items: (a, _1, _2) => a.ast,

  join: (_1, _2, _3) => null,

  merge: (a, _1, _2, _3, b) => ({
    type: "merge",
    key: a.ast,
    value: b.ast,
  }),

  assign: (a, _1, b, _2, c, _4, d) => ({
    type: "assign",
    recursive: a.sourceString === "*",
    root: a.sourceString === "&",
    source: c.sourceString === ":~",
    key: b.ast,
    value: d.ast,
  }),

  unpack: (_1, _2, a) => ({ type: "unpack", value: a.ast }),

  plainblock: (_1, a, _2, b, _3, _4, c, _5) => ({
    type: "block",
    items: [...b.ast, ...c.ast],
    capture: a.sourceString === "~",
  }),

  block: (_1, a, _2, b, _3, _4, c, _5, _6, _7) => ({
    type: "block",
    items: [{ type: "assign", key: "", value: a.ast }, ...b.ast, ...c.ast],
    capture: true,
  }),

  plainblockclosed: (_1, a, _2, b, _3, _4) => ({
    type: "block",
    items: b.ast,
    capture: a.sourceString === "~",
  }),

  blockclosed: (_1, a, _2, b, _3, _4) => ({
    type: "block",
    items: [{ type: "assign", key: "", value: a.ast }, ...b.ast],
    capture: true,
  }),

  bmerge: (a, _1, b) => ({
    type: "merge",
    key: a.ast,
    value: b.ast,
  }),

  bassign: (a, b, c, d) => ({
    type: "assign",
    recursive: a.sourceString === "*",
    root: a.sourceString === "&",
    source: c.sourceString === ":~",
    key: b.ast,
    value: d.ast,
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
        (ast[i - 1].type !== "string" || /[^\s!-]$/.test(ast[i - 1].value)) &&
        ["brackets", "array"].includes(ast[i].type)
      ) {
        if (ast[i].type === "brackets") {
          result.push(
            { type: "string", value: "(..." },
            { ...ast[i], type: "array" },
            { type: "string", value: ")" }
          );
        } else {
          result.push({ type: "string", value: "[" }, ast[i].items[0], {
            type: "string",
            value: "]",
          });
        }
      } else {
        result.push(ast[i]);
      }
    }
    const values = [] as any[];
    const code = result
      .map((v) => (v.type === "string" ? v.value : `$${values.push(v) - 1}`))
      .join("");
    return { type: "value", values, ...compileCode(code) };
  },

  vchunk: (a) => ({ type: "string", value: a.sourceString }),

  vchar: (_) => null,

  xstring: (_1, a, _2) => ({ type: "string", value: `"${a.sourceString}"` }),

  xchar: (_) => null,

  ystring: (_1, a, _2) => ({ type: "string", value: `'${a.sourceString}'` }),

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
});

const processNode = (node, processVar, depends) => {
  if (node.type === "value") {
    for (const name of node.vars.filter((n) => n[0] !== "$")) {
      processVar(name, depends);
    }
    for (const n of node.values) processNode(n, processVar, depends);
  } else if (node.type === "func") {
    if (!depends || !node.args.includes(depends)) {
      const newProcessVar = (name, depends) => {
        if (!node.args.includes(name)) processVar(name, depends);
      };
      processNode(node.body, newProcessVar, depends);
    }
  } else if (node.type === "assign") {
    processNode(node.value, processVar, depends);
  } else if (node.type === "merge") {
    if (!depends) {
      processNode(node.value, processVar, node.key);
    }
  } else if (["block", "brackets", "object", "array"].includes(node.type)) {
    const assignItems = Object.fromEntries(
      node.items
        .filter((n) => n.type === "assign" && !n.root)
        .map((n) => [n.key, n])
    );
    const orderedItems = [] as any[];
    const sourceItems = {};
    const processed = {};
    const newProcessVar = (name, depends) => {
      if (!(name in processed)) {
        if (name in assignItems) {
          processed[name] = true;
          processNode(assignItems[name], newProcessVar, depends);
          orderedItems.push(assignItems[name]);
        } else {
          const exists = processVar(name, depends);
          if (!exists && node.capture) {
            sourceItems[depends] = sourceItems[depends] || [];
            sourceItems[depends].push({
              type: "assign",
              source: true,
              key: name,
            });
            processed[name] = true;
          } else {
            processed[name] = false;
          }
        }
      }
      return processed[name];
    };
    for (const name in assignItems) newProcessVar(name, "");
    for (const n of node.items.filter((n) => n.type !== "assign" || n.root)) {
      processNode(n, newProcessVar, "");
    }
    node.assignItems = orderedItems;
    node.sourceItems = sourceItems;
    node.mergeItems = node.items.filter((n) => n.type === "merge");
    node.rootItems = node.items.filter((n) => n.type === "assign" && n.root);
    node.contentItems = node.items.filter(
      (n) => !["assign", "merge"].includes(n.type)
    );
  }
};

export default (script, library) => {
  const m = g.match(script);
  if (m.failed()) {
    console.error(m.message);
    throw new Error("Parser error");
  }
  const result = s(m).ast;
  processNode(result, (name) => name in library, "");
  return result;
};
