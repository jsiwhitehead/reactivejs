"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ohm_js_1 = __importDefault(require("ohm-js"));
const code_1 = __importDefault(require("./code"));
const grammar = String.raw `Maraca {

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
const joinValue = (parts) => parts
    .flatMap((x) => x)
    .reduce((res, p) => {
    if (typeof res[res.length - 1] === "string" && typeof p === "string") {
        res[res.length - 1] += p;
    }
    else {
        res.push(p);
    }
    return res;
}, []);
const g = ohm_js_1.default.grammar(grammar);
const s = g.createSemantics();
s.addAttribute("ast", {
    start: (_1, a, _2) => a.ast[0],
    function: (_1, _2, a, _3, _4, _5, _6, _7, b) => ({
        type: "func",
        args: a.ast,
        nodes: [b.ast],
    }),
    functionsingle: (a, _1, _2, _3, b) => ({
        type: "func",
        args: [a.ast],
        nodes: [b.ast],
    }),
    brackets: (_1, a, _2, b, _3, _4) => {
        const result = {
            type: "brackets",
            nodes: b.ast,
            capture: a.sourceString === "~",
        };
        if (!result.capture && result.nodes.length === 1) {
            return joinValue(["(", result.nodes[0], ")"]);
        }
        return result;
    },
    object: (_1, a, _2, b, _3, _4) => ({
        type: "object",
        nodes: b.ast,
        capture: a.sourceString === "~",
    }),
    array: (_1, a, _2, b, _3, _4) => {
        const result = {
            type: "array",
            nodes: b.ast,
            capture: a.sourceString === "~",
        };
        if (!result.capture &&
            result.nodes.every((n) => !["assign", "unpack", "merge"].includes(n.type))) {
            return joinValue([
                "[",
                ...result.nodes.flatMap((n, i) => [...(i > 0 ? [","] : []), n]),
                "]",
            ]);
        }
        return result;
    },
    items: (a, _1, _2) => a.ast,
    join: (_1, _2, _3) => null,
    merge: (a, _1, _2, _3, b) => ({
        type: "merge",
        key: a.ast,
        nodes: [b.ast],
    }),
    assign: (a, _1, b, _2, c, _4, d) => ({
        type: "assign",
        recursive: a.sourceString === "*",
        root: a.sourceString === "&",
        source: c.sourceString === ":~",
        key: b.ast,
        nodes: [d.ast],
    }),
    unpack: (_1, _2, a) => ({ type: "unpack", nodes: [a.ast] }),
    plainblock: (_1, a, _2, b, _3, _4, c, _5) => ({
        type: "block",
        nodes: [...b.ast, ...c.ast],
        capture: a.sourceString === "~",
    }),
    block: (_1, a, _2, b, _3, _4, c, _5, _6, _7) => ({
        type: "block",
        nodes: [{ type: "assign", key: "", value: a.ast }, ...b.ast, ...c.ast],
        capture: true,
    }),
    plainblockclosed: (_1, a, _2, b, _3, _4) => ({
        type: "block",
        nodes: b.ast,
        capture: a.sourceString === "~",
    }),
    blockclosed: (_1, a, _2, b, _3, _4) => ({
        type: "block",
        nodes: [{ type: "assign", key: "", value: a.ast }, ...b.ast],
        capture: true,
    }),
    bmerge: (a, _1, b) => ({
        type: "merge",
        key: a.ast,
        nodes: [b.ast],
    }),
    bassign: (a, b, c, d) => ({
        type: "assign",
        recursive: a.sourceString === "*",
        root: a.sourceString === "&",
        source: c.sourceString === ":~",
        key: b.ast,
        nodes: [d.ast],
    }),
    btrue: (a) => ({
        type: "assign",
        key: a.ast,
        nodes: [{ type: "value", values: [], vars: [], run: () => true }],
    }),
    bcontent: (a) => a.ast,
    bunpack: (_1, _2, a, _3) => ({ type: "unpack", nodes: [a.ast] }),
    bvalue: (_1, a, _2) => a.ast,
    bchunk: (a) => a.sourceString,
    bchar: (_) => null,
    value: (a) => {
        const ast = a.ast;
        const result = [ast[0]];
        for (let i = 1; i < ast.length; i++) {
            if ((typeof ast[i - 1] !== "string" || /[^\s!-]$/.test(ast[i - 1])) &&
                ["brackets", "array"].includes(ast[i].type)) {
                if (ast[i].type === "brackets") {
                    result.push("(", ...ast[i].nodes.flatMap((n, i) => [...(i > 0 ? [","] : []), n]), ")");
                }
                else {
                    result.push("[", ast[i].nodes[0], "]");
                }
            }
            else {
                result.push(ast[i]);
            }
        }
        return joinValue(result);
    },
    vchunk: (a) => a.sourceString,
    vchar: (_) => null,
    xstring: (_1, a, _2) => `"${a.sourceString}"`,
    xchar: (_) => null,
    ystring: (_1, a, _2) => `'${a.sourceString}'`,
    ychar: (_) => null,
    template: (_1, a, _2) => [
        "`",
        ...a.ast.flatMap((v) => {
            if (typeof v === "string")
                return v;
            if (Array.isArray(v))
                return ["${", ...v, "}"];
            return ["${", v, "}"];
        }),
        "`",
    ],
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
const processValues = (node) => {
    if (Array.isArray(node)) {
        const values = [];
        const code = node
            .map((v) => (typeof v === "string" ? v : `$${values.push(v) - 1}`))
            .join("");
        return {
            type: "value",
            nodes: values.map(processValues),
            ...(0, code_1.default)(code),
        };
    }
    else {
        return { ...node, nodes: node.nodes.map(processValues) };
    }
};
const processNode = (node, processVar, depends) => {
    if (node.type === "value") {
        for (const name of node.vars.filter((n) => n[0] !== "$")) {
            processVar(name, depends);
        }
        for (const n of node.nodes)
            processNode(n, processVar, depends);
    }
    else if (node.type === "func") {
        if (!depends || !node.args.includes(depends)) {
            const newProcessVar = (name, depends, captureUndef) => {
                if (node.args.includes(name))
                    return true;
                return processVar(name, depends, captureUndef);
            };
            processNode(node.nodes[0], newProcessVar, depends);
        }
    }
    else if (["assign", "unpack"].includes(node.type)) {
        processNode(node.nodes[0], processVar, depends);
    }
    else if (node.type === "merge") {
        if (!depends) {
            processNode(node.nodes[0], processVar, node.key);
        }
    }
    else if (["block", "brackets", "object", "array"].includes(node.type)) {
        const assignNodes = Object.fromEntries(node.nodes
            .filter((n) => n.type === "assign" && !n.root)
            .map((n) => [n.key, n]));
        const orderedNodes = [];
        const sourceNodes = {};
        const processed = {};
        const newProcessVar = (name, depends, captureUndef = node.capture ? true : undefined) => {
            if (!(name in processed)) {
                if (name in assignNodes) {
                    processed[name] = true;
                    processNode(assignNodes[name], newProcessVar, depends);
                    orderedNodes.push(assignNodes[name]);
                }
                else {
                    const exists = processVar(name, depends, captureUndef ? false : captureUndef);
                    if (!exists && captureUndef) {
                        sourceNodes[depends] = sourceNodes[depends] || [];
                        sourceNodes[depends].push({
                            type: "assign",
                            source: true,
                            key: name,
                        });
                        processed[name] = true;
                    }
                    else {
                        processed[name] = exists;
                    }
                }
            }
            return processed[name];
        };
        for (const name in assignNodes)
            newProcessVar(name, "");
        for (const n of node.nodes.filter((n) => n.type !== "assign" || n.root)) {
            processNode(n, newProcessVar, "");
        }
        node.assignNodes = orderedNodes;
        node.sourceNodes = sourceNodes;
        node.mergeNodes = node.nodes.filter((n) => n.type === "merge");
        node.rootNodes = node.nodes.filter((n) => n.type === "assign" && n.root);
        node.contentNodes = node.nodes.filter((n) => !["assign", "merge"].includes(n.type));
    }
};
exports.default = (script, library) => {
    const m = g.match(script);
    if (m.failed()) {
        console.error(m.message);
        throw new Error("Parser error");
    }
    const result = processValues(s(m).ast);
    processNode(result, (name) => name in library, "");
    return result;
};
//# sourceMappingURL=parse.js.map