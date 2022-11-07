import * as acorn from "acorn";
import * as astring from "astring";

import { derived, resolve } from "./streams";

export const reactiveFunc = (func, length?) => {
  const result = Object.assign(func, { reactiveFunc: true });
  Object.defineProperty(result, "length", { value: length || func.length });
  return result;
};

const buildCall = (func, ...args) => ({
  type: "CallExpression",
  callee: { type: "Identifier", name: func },
  arguments: args,
});

const dontResolve = {
  Program: ["body"],
  ExpressionStatement: ["expression"],
  ConditionalExpression: ["consequent", "alternate"],
  LogicalExpression: ["right"],
  CallExpression: ["arguments"],
};

const doMember = (obj, optional, prop) => {
  if (!obj && optional) return undefined;
  const res = obj[prop];
  if (typeof res !== "function") return res;
  if (Array.isArray(obj)) {
    if (["join", "includes", "indexOf", "lastIndexOf"].includes(prop)) {
      return res.bind(resolve(obj, true));
    }
    if (
      [
        "copyWithin",
        "fill",
        "pop",
        "push",
        "reverse",
        "shift",
        "sort",
        "splice",
        "unshift",
      ].includes(prop)
    ) {
      return res.bind([...obj]);
    }
  }
  return res.bind(obj);
};
const doCall = (func, optional, ...args) => {
  if (!func && optional) return undefined;
  if (func.reactiveFunc) {
    return func(...args);
  }
  if (["bound map", "bound reduce"].includes(func.name)) {
    return func(...args.map((a, i) => (i === 0 ? resolve(a) : a)));
  }
  if (["bound flatMap", "bound sort"].includes(func.name)) {
    return func(
      ...args.map((a) => {
        const v = resolve(a);
        return typeof v === "function" ? (...x) => resolve(v(...x)) : v;
      })
    );
  }
  return func(
    ...args.map((a) => {
      const v = resolve(a, true);
      return typeof v === "function" ? (...x) => resolve(v(...x), true) : v;
    })
  );
};

export default (code) => {
  const vars = {};

  const updateNode = (node, parent, prop) => {
    if (
      node.type === "Identifier" &&
      !["undefined", "null"].includes(node.name) &&
      prop !== "key"
    ) {
      const value = { type: "Literal", value: node.name };
      if (prop === "property" && !parent.computed) return value;
      vars[node.name] = true;
      return buildCall("getValue", value);
    }
    if (node.type === "MemberExpression") {
      return buildCall(
        "doMember",
        node.object,
        { type: "Identifier", name: node.optional ? "true" : "false" },
        node.property
      );
    }
    if (node.type === "CallExpression") {
      return buildCall(
        "doCall",
        node.callee,
        { type: "Identifier", name: node.optional ? "true" : "false" },
        ...node.arguments
      );
    }
    return node;
  };

  const walkNode = (node, doResolve?, parent?, prop?) => {
    if (typeof node !== "object" || typeof node.type !== "string") return node;

    const walked = Object.fromEntries(
      Object.entries(node).map(([k, v]) => {
        const res = doResolve || !dontResolve[node.type]?.includes(k);
        if (Array.isArray(v)) {
          return [k, v.map((x) => walkNode(x, res, node, k))];
        }
        return [k, walkNode(v, res, node, k)];
      })
    );
    const updated = updateNode(walked, parent, prop);

    if (doResolve && updated !== walked) return buildCall("resolve", updated);
    return updated;
  };

  const ast = walkNode(acorn.parse(code, { ecmaVersion: 2022 }));
  const newCode = astring.generate(ast);
  const func = Function(
    `"use strict";
    return (getValue, doMember, doCall, resolve) => {
      return ${newCode}
    };`
  )();

  return {
    vars: Object.keys(vars),
    run: (getValue) =>
      derived(() => func(getValue, doMember, doCall, resolve), code) as any,
  };
};
