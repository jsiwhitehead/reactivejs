import * as acorn from "acorn";
import * as astring from "astring";

import { createSignal, createComputed, untrack } from "./signal";
import parse from "./parse";
import walk from "./walk";

export const isObject = (x) =>
  Object.prototype.toString.call(x) === "[object Object]";

export const isReactive = (x) => typeof x === "function" && x.isReactive;

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

const addGetResolve = (tree) => {
  walk(tree, {
    enter(node, parent, prop) {
      if (
        node.type === "MemberExpression" &&
        parent &&
        parent.type !== "CallExpression"
      ) {
        this.replace({
          type: "CallExpression",
          callee: {
            type: "Identifier",
            name: "resolve",
          },
          arguments: [addGetResolve(node)],
        });
        this.skip();
      }
      if (node.type === "Identifier" && prop !== "property") {
        this.replace({
          type: "CallExpression",
          callee: {
            type: "Identifier",
            name: "resolve",
          },
          arguments: [
            {
              type: "CallExpression",
              callee: {
                type: "Identifier",
                name: node.name[0] === "$" ? "val" : "get",
              },
              arguments: [{ type: "Literal", value: node.name }],
            },
          ],
        });
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
      .map((v, i) => {
        if (typeof v === "string") return v;
        if (isObject(node[i]) && node[i].type === "brackets") return `($${i})`;
        return `$${i}`;
      })
      .join("");
    const tree = acorn.parse(code, { ecmaVersion: 2020 });
    addGetResolve(tree);
    const newCode = astring.generate(tree).split(";\n").slice(0, -1);
    const func = Function(
      `"use strict";
      return function(resolve, get, val) {
        ${newCode
          .map((c, i) => `${i === newCode.length - 1 ? "return " : ""}${c};`)
          .join("\n")}
      };`
    )();
    const result = () =>
      func(
        (v) => (isReactive(v) ? v() : v),
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

  const values = {};
  node.items
    .filter((n) => isObject(n) && n.type === "merge")
    .forEach(({ key, value }) => {
      if ((!value || !getVar(key)) && !values[key]) {
        const [get, set] = createSignal(undefined, { equals: false });
        Object.assign(get, { isReactive: true, set });
        values[key] = get;
      }
    }, {});

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
        newGetVar,
        noTrack
      ));
    }
    const res = getVar(name, captureUndef ? false : captureUndef);
    if (res === null && captureUndef) {
      const [get, set] = createSignal(undefined, { equals: false });
      Object.assign(get, { isReactive: true, set });
      return (values[name] = get);
    }
    return res;
  };
  for (const name of Object.keys(assignItems)) newGetVar(name);

  const mergeItems = node.items.filter(
    (n) => isObject(n) && n.type === "merge" && n.value
  );
  for (const { key, value } of mergeItems) {
    const source = compileNode(value, newGetVar, key);
    const target = newGetVar(key);
    createComputed(() => {
      target.set(isReactive(source) ? source() : source);
    });
  }

  if (!node.items.some((n) => isObject(n) && n.type === "unpack")) {
    const contentItems = node.items.filter(
      (n) => !(isObject(n) && ["merge", "assign"].includes(n.type))
    );
    const content = contentItems.map((c) => compileNode(c, newGetVar, noTrack));
    if (node.type === "brackets") return content[content.length - 1];
    if (node.type === "block")
      return { type: "block", tag: node.tag, values, items: content };
    if (node.type === "object") return values;
    if (node.type === "array") return content;
    return null;
  }

  const result = () => {
    const content = [];
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
        Object.assign(values, block.values);
        content.push(...block.items);
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
  Object.assign(result, { isReactive: true });
  return result;
};

export default (script, library = {}) => {
  const ast = parse(script);
  return compileNode(ast, (name) => library[name] || null, null);
};
