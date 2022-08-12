import * as acorn from "acorn";
import * as astring from "astring";

import { isObject, mapObject } from "./util";

const buildCallNode = (func, ...args) => ({
  type: "CallExpression",
  callee: { type: "Identifier", name: func },
  arguments: args,
});

const updateNode = (node, parent, prop) => {
  if (node.type === "Identifier") {
    const value = { type: "Literal", value: node.name };
    if (prop === "property" && !parent.computed) return value;
    return buildCallNode("getValue", value);
  }
  if (node.type === "MemberExpression") {
    return buildCallNode("doMember", node.object, node.property);
  }
  if (node.type === "CallExpression") {
    return buildCallNode("doCall", node.callee, ...node.arguments);
  }
  return node;
};

const dontResolve = {
  Program: ["body"],
  ExpressionStatement: ["expression"],
  ConditionalExpression: ["consequent", "alternate"],
  LogicalExpression: ["right"],
  CallExpression: ["arguments"],
};

export default (code) => {
  let hasResolve = false;

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
      return buildCallNode("resolve", updated);
    }
    return updated;
  };

  const tree = walkNode(acorn.parse(code, { ecmaVersion: 2022 }));
  for (const e of tree.body.slice(0, -1)) {
    hasResolve = true;
    e.expression = buildCallNode("resolveDeep", e.expression);
  }

  return {
    code: astring.generate(tree).split(";\n").slice(0, -1),
    hasResolve,
  };
};
