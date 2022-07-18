import * as acorn from "acorn";
import * as astring from "astring";

import { createSignal, createComputed, createMemo, untrack } from "./signal";
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

const createDerived = (func, alwaysTrigger = false) => {
  const result = createMemo(func, null, {
    equals: alwaysTrigger ? false : undefined,
  });
  Object.assign(result, { isReactive: true });
  return result;
};

const buildCallNode = (func, arg) => ({
  type: "CallExpression",
  callee: {
    type: "Identifier",
    name: func,
  },
  arguments: [arg],
});
const maybeResolve = (node, parentType) =>
  ["CallExpression", "ExpressionStatement"].includes(parentType)
    ? node
    : buildCallNode("resolve", node);
const updateTree = (tree) => {
  walk(tree, {
    enter(node, parent, prop) {
      if (node.type === "Identifier" && prop !== "property") {
        const method = node.name[0] === "$" ? "val" : "get";
        this.replace(
          maybeResolve(
            buildCallNode(method, { type: "Literal", value: node.name }),
            parent.type
          )
        );
        this.skip();
      }
      if (node.type === "MemberExpression" && parent) {
        this.replace(
          maybeResolve(updateTree({ ...node, optional: true }), parent.type)
        );
        this.skip();
      }
      if (node.type === "CallExpression" && parent) {
        this.replace(maybeResolve(updateTree(node), parent.type));
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
    if (
      tree.body.length === 1 &&
      tree.body[0].expression.type === "Identifier"
    ) {
      const name = tree.body[0].expression.name;
      if (name[0] === "$") return values[parseInt(name.slice(1), 10)];
      return name === noTrack
        ? untrack(() => resolve(getVar(name)))
        : getVar(name);
    }
    updateTree(tree);
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
    return createDerived(
      () =>
        func(
          (v) => resolveSingle(v),
          (v) => resolve(v),
          (name) =>
            name === noTrack
              ? untrack(() => resolve(getVar(name)))
              : getVar(name),
          (id) => values[parseInt(id.slice(1), 10)]
        ),
      newCode.length > 1
    );
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
    return createDerived(() => {
      const value = resolveSingle(getVar(node.name));
      const index = resolveSingle(compileNode(node.items[0], getVar, noTrack));
      return value?.[index];
    });
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

    const tempContent = [] as any[];
    for (const n of node.items.filter(
      (n) => !(isObject(n) && ["assign", "merge"].includes(n.type))
    )) {
      if (isObject(n) && n.type === "unpack") {
        const v = resolveSingle(compileNode(n.value, getVar, noTrack));
        const block = isObject(v)
          ? v.type === "block"
            ? v
            : { values: v }
          : { items: v };
        Object.assign(values, block.values || {});
        tempContent.push(
          ...(block.items || []).map((x) => ({ compiled: true, value: x }))
        );
      } else {
        tempContent.push({ compiled: false, value: n });
      }
    }

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
      const target = newGetVar(key);
      createComputed(() => {
        const res = resolve(source);
        if (!first) target.set(res);
        first = false;
      });
    }

    const content = tempContent.map((x) =>
      x.compiled ? x.value : compileNode(x.value, newGetVar, noTrack)
    );

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
  return createDerived(result);
};

export default (script, library = {}) => {
  const ast = parse(script);
  return compileNode(ast, (name) => library[name] || null, null);
};
