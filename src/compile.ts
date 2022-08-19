import { atom, derived, stream } from "./streams";
import { resolve, isObject } from "./util";

const doMember = (obj, prop) => {
  const res = obj[prop];
  return typeof res === "function" ? res.bind(obj) : res;
};
const doCall = (func, args) => {
  if (func.reactiveFunc || func.name === "bound map") return func(...args);
  return func(
    ...args.map((a) => {
      const v = resolve(a, true);
      return typeof v === "function" ? (...x) => resolve(v(...x), true) : v;
    })
  );
};

const compileNode = (node, getVar) => {
  if (typeof node === "string") return node;

  if (node.type === "value") {
    const compiled = [] as any[];
    const getValue = (name) => {
      if (name[0] === "$") {
        const index = parseInt(name.slice(1), 10);
        if (!compiled[index]) {
          compiled[index] = compileNode(node.values[index], getVar);
        }
        return compiled[index];
      }
      return getVar(name);
    };

    const func = Function(
      `"use strict";
      return (getValue, doMember, doCall, resolve) => {
        ${node.code}
      };`
    )();

    if (!node.hasResolve) return func(getValue, doMember, doCall);
    return derived(() => func(getValue, doMember, doCall, resolve));
  }

  if (node.type === "func") {
    const result = (...args) => {
      const newGetVar = (name) => {
        const index = node.args.indexOf(name);
        if (index !== -1) return args[index];
        return getVar(name);
      };
      return compileNode(node.body, newGetVar);
    };
    Object.assign(result, { reactiveFunc: true });
    return result;
  }

  return compileBlock(node, getVar);
};

const unpackValue = (v) => {
  if (isObject(v)) return v.type === "block" ? v : { values: v, items: [] };
  if (Array.isArray(v)) return { values: {}, items: v };
  return { values: {}, items: [] };
};
const constructBlock = (type, tag, values, items) => {
  if (type === "brackets") return items[items.length - 1];
  if (type === "block") return { type: "block", tag, values, items };
  if (type === "object") return values;
  if (type === "array") return items;
  return null;
};
const compileBlock = ({ type, tag, items }, getVar) => {
  const result = () => {
    const values = {};

    const partialValues = {};
    const partialContent = [] as any[];
    for (const n of items.filter(
      (n) => !(isObject(n) && ["assign", "merge"].includes(n.type))
    )) {
      if (isObject(n) && n.type === "unpack") {
        const block = unpackValue(resolve(compileNode(n.value, getVar)));
        Object.assign(values, block.values);
        Object.assign(partialValues, block.values);
        partialContent.push(
          ...block.items.map((x) => ({ compiled: true, value: x }))
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
      if (values.hasOwnProperty(name)) return values[name];
      if (assignItems[name]) {
        return (values[name] = compileNode(assignItems[name], (n, c) =>
          n === name &&
          !(
            assignItems[name].type === "value" &&
            assignItems[name].values.length === 1 &&
            assignItems[name].values[0].type === "func"
          )
            ? partialValues.hasOwnProperty(n)
              ? partialValues[n]
              : getVar(n, c)
            : newGetVar(n, c)
        ));
      }
      const res = getVar(name, captureUndef ? false : captureUndef);
      if (res === undefined && captureUndef) return (values[name] = atom());
      return res;
    };

    for (const name of Object.keys(assignItems)) delete values[name];
    for (const name of Object.keys(assignItems)) newGetVar(name);

    const mergeItems = items.filter((n) => isObject(n) && n.type === "merge");
    for (const { key, value } of mergeItems) {
      if (!value || !getVar(key, false)) values[key] = atom();
    }
    const merges = mergeItems
      .filter((n) => n.value)
      .map(({ key, value }) => {
        {
          const source = compileNode(value, newGetVar);
          const target = newGetVar(key);
          return stream(() => {
            let first =
              isObject(value) && value.type === "value" && value.multi;
            return () => {
              const res = resolve(source, true);
              if (!first) target.set(res);
              first = false;
            };
          });
        }
      });

    const content = partialContent.map((x) =>
      x.compiled ? x.value : compileNode(x.value, newGetVar)
    );

    return { block: constructBlock(type, tag, values, content), merges };
  };

  if (items.some((n) => isObject(n) && ["merge", "unpack"].includes(n.type))) {
    const blockStream = derived(result);
    return derived(() => {
      const { block, merges } = blockStream.get();
      for (const m of merges) m.get();
      return block;
    });
  }
  return result().block;
};

export default compileNode;
