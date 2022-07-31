import * as acorn from "acorn";
import * as astring from "astring";

import { isObject, mapObject } from "./util";

const callNode = (func, ...args) => ({
  type: "CallExpression",
  callee: { type: "Identifier", name: func },
  arguments: args,
});

const updateNode = (node, parent, prop) => {
  if (node.type === "Identifier") {
    const value = { type: "Literal", value: node.name };
    if (prop === "property" && !parent.computed) return value;
    return callNode("getValue", value);
  }
  if (node.type === "MemberExpression") {
    return callNode("doMember", node.object, node.property);
  }
  if (node.type === "CallExpression") {
    return callNode("doCall", node.callee, ...node.arguments);
  }
  return node;
};

export default (code) => {
  let hasResolve = false;

  const walkNode = (node, parent?, prop?) => {
    if (!isObject(node) || typeof node.type !== "string") return node;

    const walked = mapObject(node, (v, k) =>
      Array.isArray(v)
        ? v.map((x) => walkNode(x, node, k))
        : walkNode(v, node, k)
    );
    const updated = updateNode(walked, parent, prop);

    if (
      parent?.type !== "ExpressionStatement" &&
      (updated !== walked || node.type === "CallExpression")
    ) {
      hasResolve = true;
      return callNode("resolve", updated);
    }

    return updated;
  };

  const tree = walkNode(acorn.parse(code, { ecmaVersion: 2022 }));
  for (const e of tree.body.slice(0, -1)) {
    hasResolve = true;
    e.expression = callNode("resolveDeep", e.expression);
  }

  return {
    code: astring.generate(tree).split(";\n").slice(0, -1),
    hasResolve,
  };
};
