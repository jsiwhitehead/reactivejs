import { createDerived, createReactive, isObject, resolve } from "./util";

const doMember = (obj, prop) => {
  const res = obj?.[prop];
  return typeof res === "function" ? res.bind(obj) : res;
};
const doCall = (func, args) => {
  if (func?.reactiveFunc || func?.name === "bound map") {
    return func?.(...args);
  }
  return func?.(
    ...args.map((a) => {
      const v = resolve(a, true);
      return typeof v === "function" ? (...x) => resolve(a(...x), true) : v;
    })
  );
};

const compileNode = (node, getVar, noTrack?) => {
  if (typeof node === "string") return node;

  if (node.type === "value") {
    const compiled = [] as any[];
    const getValue = (name) => {
      if (name[0] === "$") {
        const index = parseInt(name.slice(1), 10);
        if (!compiled[index]) {
          compiled[index] = compileNode(node.values[index], getVar, noTrack);
        }
        return compiled[index];
      }
      if (name === noTrack) {
        return createDerived(() => resolve(getVar(name), true), true);
      }
      return getVar(name);
    };

    const func = Function(
      `"use strict";
      return (getValue, doMember, doCall, resolve, resolveDeep) => {
        ${node.code}
      };`
    )();

    if (!node.hasResolve) return func(getValue, doMember, doCall);
    return createDerived(() =>
      func(getValue, doMember, doCall, resolve, (x) => resolve(x, true))
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

  return compileBlock(node, getVar, noTrack);
};

const compileBlock = ({ type, tag, items }, getVar, noTrack) => {
  const result = () => {
    const values = {};

    const partialValues = {};
    const partialContent = [] as any[];
    for (const n of items.filter(
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
        Object.assign(partialValues, block.values || {});
        partialContent.push(
          ...(block.items || []).map((x) => ({ compiled: true, value: x }))
        );
      } else {
        partialContent.push({ compiled: false, value: n });
      }
    }

    const assignItems = items
      .filter((n) => isObject(n) && n.type === "assign")
      .reduce((res, { key, value }) => ({ ...res, [key]: value }), {});
    const newGetVar = (
      name,
      captureUndef = type === "block" ? true : undefined
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
              ? partialValues[n] !== undefined
                ? partialValues[n]
                : getVar(n, c)
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

    for (const name of Object.keys(assignItems)) delete values[name];
    for (const name of Object.keys(assignItems)) newGetVar(name);

    const mergeItems = items.filter((n) => isObject(n) && n.type === "merge");
    for (const { key, value } of mergeItems) {
      if (!value || !getVar(key)) values[key] = createReactive();
    }
    for (const { key, value } of mergeItems.filter((n) => n.value)) {
      const source = compileNode(value, newGetVar, key);
      let first = isObject(value) && value.type === "value" && value.multi;
      const target = newGetVar(key);
      createDerived(() => {
        const res = resolve(source, true);
        if (!first) target(res);
        first = false;
      });
    }

    const content = partialContent.map((x) =>
      x.compiled ? x.value : compileNode(x.value, newGetVar, noTrack)
    );

    if (type === "brackets") return content[content.length - 1];
    if (type === "block") return { type: "block", tag, values, items: content };
    if (type === "object") return values;
    if (type === "array") return content;
    return null;
  };

  if (!items.some((n) => isObject(n) && n.type === "unpack")) return result();
  return createDerived(result);
};

export default compileNode;
