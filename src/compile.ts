import * as acorn from "acorn";
import * as astring from "astring";

import { createSignal, createComputed, untrack } from "./signal";
import parse from "./parse";
import walk from "./walk";

export const isObject = (x) =>
  Object.prototype.toString.call(x) === "[object Object]";

export const isReactive = (x) => typeof x === "function" && x.isReactive;

export const createReactive = (initial?) => {
  const [get, set] = createSignal(initial, { equals: false });
  Object.assign(get, { isReactive: true, set });
  return get as any;
};

export const resolveSingle = (x) => (isReactive(x) ? resolveSingle(x()) : x);

export const resolveSet = (x) =>
  isReactive(x) && !x.set ? resolveSet(x()) : x;

export const resolve = (node) => {
  if (isReactive(node)) return resolve(node());
  if (Array.isArray(node)) return node.map((x) => resolve(x));
  if (isObject(node)) {
    return Object.keys(node).reduce(
      (res, k) => ({ ...res, [k]: resolve(node[k]) }),
      {}
    );
  }
  return node;
};

const buildCallNode = (func, arg) => ({
  type: "CallExpression",
  callee: {
    type: "Identifier",
    name: func,
  },
  arguments: [arg],
});
const addGetResolve = (tree) => {
  walk(tree, {
    enter(node, parent, prop) {
      if (node.type === "Identifier" && prop !== "property") {
        const inner = buildCallNode(node.name[0] === "$" ? "val" : "get", {
          type: "Literal",
          value: node.name,
        });
        if (
          parent.type !== "CallExpression" &&
          parent.type !== "ExpressionStatement"
        ) {
          this.replace(buildCallNode("resolve", inner));
        } else {
          this.replace(inner);
        }
        this.skip();
      }
      if (
        node.type === "MemberExpression" &&
        parent &&
        parent.type !== "CallExpression" &&
        parent.type !== "ExpressionStatement"
      ) {
        this.replace(buildCallNode("resolve", addGetResolve(node)));
        this.skip();
      }
      if (node.type === "CallExpression" && parent) {
        this.replace(buildCallNode("resolve", addGetResolve(node)));
        this.skip();
      }
    },
  });
  return tree;
};

const compileNode = (node, getVar, noTrack) => {
  if (!node) return node;
  if (typeof node === "string") return node;

  if (Array.isArray(node)) {
    const values = node.map((v) => compileNode(v, getVar, noTrack));
    if (values.length === 1 && typeof values[0] !== "string") return values[0];
    const code = values
      .map((v, i) => (typeof v === "string" ? v : `$${i}`))
      .join("");
    const tree = acorn.parse(code, { ecmaVersion: 2022 }) as any;
    addGetResolve(tree);
    for (const e of tree.body.slice(0, -1)) {
      e.expression = buildCallNode("resolveAll", e.expression);
    }
    const newCode = astring.generate(tree).split(";\n").slice(0, -1);
    const func = Function(
      `"use strict";
      return function(resolve, resolveAll, get, val) {
        ${newCode
          .map((c, i) => `${i === newCode.length - 1 ? "return " : ""}${c};`)
          .join("\n")}
      };`
    )();
    const result = () =>
      func(
        (v) => resolveSingle(v),
        (v) => resolve(v),
        (name) =>
          name === noTrack ? untrack(() => getVar(name)()) : getVar(name),
        (id) => values[parseInt(id.slice(1), 10)]
      );
    Object.assign(result, { isReactive: true });
    return result;
  }

  if (node.type === "func") {
    return (...args) => {
      const newGetVar = (name) => {
        const index = node.args.indexOf(name);
        if (index !== -1) return args[index];
        return getVar(name);
      };
      return compileNode(node.body, newGetVar, noTrack);
    };
  }

  if (node.type === "index") {
    const result = () => {
      const value = resolveSingle(getVar(node.name));
      const index = resolveSingle(compileNode(node.items[0], getVar, noTrack));
      return value[index];
    };
    Object.assign(result, { isReactive: true });
    return result;
  }

  if (node.type === "call") {
    const func = getVar(node.name);
    const args = node.items.map((x) => compileNode(x, getVar, noTrack));
    return func(...args);
  }

  const result = () => {
    const values = {};

    const assignItems = node.items
      .filter((n) => isObject(n) && n.type === "assign")
      .reduce((res, { key, value }) => ({ ...res, [key]: value }), {});
    const newGetVar = (
      name,
      captureUndef = node.type === "block" ? true : undefined
    ) => {
      if (values[name] !== undefined) return values[name];
      if (assignItems[name]) {
        return (values[name] = compileNode(
          assignItems[name],
          (n, c) => (n === name ? getVar(n, c) : newGetVar(n, c)),
          noTrack
        ));
      }
      const res = getVar(name, captureUndef ? false : captureUndef);
      if (res === null && captureUndef) {
        return (values[name] = createReactive());
      }
      return res;
    };
    for (const name of Object.keys(assignItems)) newGetVar(name);

    node.items
      .filter((n) => isObject(n) && n.type === "merge")
      .forEach(({ key, value }) => {
        if ((!value || !getVar(key)) && !values[key]) {
          values[key] = createReactive();
        }
      }, {});
    const mergeItems = node.items.filter(
      (n) => isObject(n) && n.type === "merge" && n.value
    );
    for (const { key, value } of mergeItems) {
      const source = compileNode(value, newGetVar, key);
      let first =
        (typeof value === "string" && value.includes(";")) ||
        (Array.isArray(value) &&
          value.some((v) => typeof v === "string" && v.includes(";")));
      const target = resolveSet(newGetVar(key));
      createComputed(() => {
        const res = resolve(source);
        if (!first) target.set(res);
        first = false;
      });
    }

    const content = [] as any[];
    for (const n of node.items.filter(
      (n) => !(isObject(n) && ["assign", "merge"].includes(n.type))
    )) {
      if (isObject(n) && n.type === "unpack") {
        const compiled = compileNode(n.value, newGetVar, noTrack);
        const v = isReactive(compiled) ? compiled() : compiled;
        const block = isObject(v)
          ? v.type === "block"
            ? v
            : { values: v }
          : { items: v };
        Object.assign(values, block.values || {});
        content.push(...(block.items || []));
      } else {
        content.push(compileNode(n, newGetVar, noTrack));
      }
    }

    if (node.type === "brackets") return content[content.length - 1];
    if (node.type === "block")
      return { type: "block", tag: node.tag, values, items: content };
    if (node.type === "object") return values;
    if (node.type === "array") return content;
    return null;
  };

  if (!node.items.some((n) => isObject(n) && n.type === "unpack")) {
    return result();
  }
  Object.assign(result, { isReactive: true });
  return result;
};

export default (script, library = {}) => {
  const ast = parse(script);
  return compileNode(ast, (name) => library[name] || null, null);
};
