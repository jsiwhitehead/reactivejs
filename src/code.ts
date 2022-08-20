import * as acorn from "acorn";
import * as astring from "astring";

import { isObject, mapObject } from "./util";

const buildBoolean = (value) => ({
  type: "Identifier",
  name: value ? "true" : "false",
});
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

export default (code) => {
  const vars = new Set();
  let hasResolve = false;

  const updateNode = (node, parent, prop) => {
    if (
      node.type === "Identifier" &&
      !["undefined", "null"].includes(node.name)
    ) {
      const value = { type: "Literal", value: node.name };
      if (prop === "property" && !parent.computed) return value;
      if (node.name[0] !== "$") vars.add(node.name);
      return buildCall("getValue", value);
    }
    if (node.type === "MemberExpression") {
      return buildCall(
        "doMember",
        node.object,
        node.property,
        buildBoolean(node.optional)
      );
    }
    if (node.type === "CallExpression") {
      return buildCall(
        "doCall",
        node.callee,
        node.arguments[0],
        buildBoolean(node.optional)
      );
    }
    return node;
  };

  const walkNode = (node, resolve?, parent?, prop?) => {
    if (!isObject(node) || typeof node.type !== "string") return node;

    const walked = mapObject(node, (v, k) => {
      const res = resolve || !dontResolve[node.type]?.includes(k);
      if (Array.isArray(v)) return v.map((x) => walkNode(x, res, node, k));
      return walkNode(v, res, node, k);
    });
    const updated = updateNode(walked, parent, prop);

    if (resolve && updated !== walked) {
      hasResolve = true;
      return buildCall("resolve", updated);
    }
    return updated;
  };

  const tree = walkNode(acorn.parse(code, { ecmaVersion: 2022 }));
  for (const e of tree.body.slice(0, -1)) {
    hasResolve = true;
    e.expression = buildCall("resolve", e.expression, buildBoolean(true));
  }

  return { code: "return " + astring.generate(tree), vars, hasResolve };
};
