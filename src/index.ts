import * as acorn from "acorn";
import * as astring from "astring";

import {
  createComputed,
  createEffect,
  createMemo,
  createRoot,
  createSignal,
  untrack,
} from "./signal";
import parse from "./parse";

const isObject = (x) => Object.prototype.toString.call(x) === "[object Object]";

const mapObject = (obj, map) =>
  Object.keys(obj).reduce((res, k) => ({ ...res, [k]: map(obj[k], k) }), {});

export const createReactive = (initial?) => {
  const [get, set] = createSignal(initial, { equals: false });
  Object.assign(get, { isReactive: true, set });
  return get as any;
};

export const isReactive = (x) => typeof x === "function" && x.isReactive;

export const resolve = (node, deep = false) => {
  if (isReactive(node)) return resolve(node(), deep);
  if (!deep) return node;
  if (Array.isArray(node)) return node.map((x) => resolve(x, true));
  if (isObject(node)) {
    return Object.keys(node).reduce(
      (res, k) => ({ ...res, [k]: resolve(node[k], true) }),
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
const updateTree = (tree) => {
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

  const newTree = walkNode(tree);
  for (const e of newTree.body.slice(0, -1)) {
    hasResolve = true;
    e.expression = buildCallNode("resolveDeep", e.expression);
  }
  return { newTree, hasResolve };
};

const compileNode = (node, getVar, noTrack) => {
  if (typeof node === "string") return node;

  if (Array.isArray(node)) {
    const code = node
      .map((v, i) => (typeof v === "string" ? v : `$${i}`))
      .join("");
    const compiled = [] as any[];
    const getValue = (name) => {
      if (name[0] === "$") {
        const index = parseInt(name.slice(1), 10);
        if (!compiled[index]) {
          compiled[index] = compileNode(node[index], getVar, noTrack);
        }
        return compiled[index];
      }
      if (name === noTrack) {
        return untrack(() => resolve(getVar(name), true));
      }
      return getVar(name);
    };
    const tree = acorn.parse(code, { ecmaVersion: 2022 }) as any;
    const { newTree, hasResolve } = updateTree(tree);
    const newCode = astring.generate(newTree).split(";\n").slice(0, -1);
    const func = Function(
      `"use strict";
      return function(getValue, resolve, resolveDeep) {
        ${newCode
          .map((c, i) => `${i === newCode.length - 1 ? "return " : ""}${c};`)
          .join("\n")}
      };`
    )();
    if (!hasResolve) return func(getValue);
    return createDerived(
      () => func(getValue, resolve, (x) => resolve(x, true)),
      newCode.length > 1
    );
  }

  if (node.type === "func") {
    const result = (...args) => {
      const newGetVar = (name) => {
        const index = node.args.indexOf(name);
        if (index !== -1) return args[index];
        return getVar(name);
      };
      return compileNode(node.body, newGetVar, noTrack);
    };
    Object.assign(result, { reactiveFunc: true });
    return result;
  }

  if (node.type === "index") {
    return createDerived(() => {
      const value = resolve(getVar(node.name));
      const index = resolve(compileNode(node.items[0], getVar, noTrack));
      return value?.[index];
    });
  }

  if (node.type === "call") {
    const base = compileNode([node.base], getVar, noTrack);
    const func = node.path.reduce(
      (res, p) =>
        typeof res?.[p] === "function" ? res?.[p].bind(res) : res?.[p],
      base
    );
    const args = node.items.map((x) => compileNode(x, getVar, noTrack));
    if (typeof func !== "function" || !func.reactiveFunc) {
      return createDerived(() => {
        const func = node.path.reduce((res, p, i) => {
          const next = resolve(res[p]);
          return i === node.path.length - 1 ? next.bind(res) : next;
        }, resolve(base));
        return func(
          ...args.map((a) => {
            const v = resolve(a, true);
            return typeof v === "function"
              ? (...x) => resolve(a(...x), true)
              : v;
          })
        );
      });
    }
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
          (n, c) =>
            n === name &&
            !(
              assignItems[name].length === 1 &&
              assignItems[name][0].type === "func"
            )
              ? getVar(n, c)
              : newGetVar(n, c),
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
        const v = resolve(compileNode(n.value, getVar, noTrack));
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
        const res = resolve(source, true);
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

export default (script, library = {}, update) => {
  createRoot(() => {
    const compiled = compileNode(
      parse(script),
      (name) => library[name] || null,
      null
    );
    createEffect(() => {
      update(compiled);
    });
  });
};
