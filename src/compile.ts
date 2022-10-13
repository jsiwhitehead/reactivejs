import { reactiveFunc } from "./code";
import { atom, derived, effect } from "./streams";
import { resolve, isObject } from "./util";

const unpackValue = (v) => {
  if (isObject(v)) return v.type === "block" ? v : { values: v, items: [] };
  if (Array.isArray(v)) return { values: {}, items: v };
  return { values: {}, items: [] };
};

const readVars = (node, getVar, ignoreBlock = false) => {
  if (isObject(node)) {
    if (node.type === "value") {
      for (const name of node.vars.filter((n) => n[0] !== "$")) getVar(name);
      for (const v of node.values) readVars(v, getVar, true);
    } else if (
      ["brackets", "object", "array"].includes(node.type) ||
      (node.type === "block" && !ignoreBlock)
    ) {
      for (const item of node.items) {
        if (
          isObject(item) &&
          ["merge", "assign", "unpack"].includes(item.type)
        ) {
          if (item.type !== "merge") readVars(item.value, getVar, true);
        } else {
          readVars(item, getVar, true);
        }
      }
    }
  }
};

const compileNode = (node, getVar) => {
  if (typeof node === "string") return node;

  if (node.type === "value") {
    const compiled = [] as any[];
    return node.run((name) => {
      if (name[0] === "$") {
        const index = parseInt(name.slice(1), 10);
        if (!compiled[index]) {
          compiled[index] = compileNode(node.values[index], getVar);
        }
        return compiled[index];
      }
      return getVar(name);
    });
  }

  if (node.type === "func") {
    return reactiveFunc((...args) => {
      const newGetVar = (name, captureUndef) => {
        const index = node.args.indexOf(name);
        if (index !== -1) return args[index];
        return getVar(name, captureUndef);
      };
      return compileNode(node.body, newGetVar);
    });
  }

  const { type, tag, items } = node;
  return derived(() => {
    const assignItems = items
      .filter((n) => isObject(n) && n.type === "assign")
      .reduce((res, { key, value }) => ({ ...res, [key]: value }), {});
    const contentItems = items.filter(
      (n) => !(isObject(n) && ["assign", "merge"].includes(n.type))
    );
    const mergeItems = items.filter((n) => isObject(n) && n.type === "merge");

    const values = {};

    const partialValues = {};
    const partialContent = [] as any[];
    for (const n of contentItems) {
      if (isObject(n) && n.type === "unpack") {
        const value = resolve(compileNode(n.value, getVar));
        if (isObject(value)) {
          if (value.type === "block" && type === "block") {
            Object.assign(values, value.values);
            Object.assign(partialValues, value.values);
            partialContent.push(
              ...value.items.map((x) => ({ compiled: true, value: x }))
            );
          } else {
            Object.assign(values, value);
            Object.assign(partialValues, value);
          }
        } else if (Array.isArray(value)) {
          partialContent.push(
            ...value.map((x) => ({ compiled: true, value: x }))
          );
        }
      } else {
        partialContent.push({ compiled: false, value: n });
      }
    }

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
      if (res === undefined && captureUndef) return (values[name] = atom(null));
      return res;
    };

    for (const name of Object.keys(assignItems)) delete values[name];
    for (const name of Object.keys(assignItems)) newGetVar(name);
    for (const { key } of mergeItems.filter((n) => n.source)) {
      values[key] = atom(null);
    }
    readVars(node, newGetVar);

    const content = partialContent.map((x) =>
      x.compiled ? x.value : compileNode(x.value, newGetVar)
    );

    for (const { key, value } of mergeItems.filter((n) => n.value)) {
      const target = newGetVar(key, false);
      if (isObject(target) && target.isStream && target.set) {
        const source = compileNode(value, newGetVar);
        effect(() => {
          const res = resolve(source, true);
          if (res !== undefined) target.set(res);
        }, `merge ${key}`);
      }
    }

    if (type === "brackets") return content[content.length - 1];
    if (type === "block") return { type: "block", tag, values, items: content };
    if (type === "object") return values;
    if (type === "array") return content;
    return null;
  }, "block");
};

export default compileNode;
