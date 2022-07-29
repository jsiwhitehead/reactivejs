import * as acorn from "acorn";
import * as astring from "astring";

import { isObject, mapObject } from "./util";

const buildCallNode = (func, arg) => ({
  type: "CallExpression",
  callee: { type: "Identifier", name: func },
  arguments: [arg],
});

const updateNode = (node, prop) => {
  if (node.type === "Identifier" && prop !== "property") {
    return buildCallNode("getValue", { type: "Literal", value: node.name });
  }
  if (node.type === "MemberExpression") {
    return { ...node, optional: true };
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
    const updated = updateNode(walked, prop);

    if (
      parent?.type !== "ExpressionStatement" &&
      (updated !== walked || node.type === "CallExpression")
    ) {
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
