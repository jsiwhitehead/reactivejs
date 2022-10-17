import { reactiveFunc } from "./code";
import { atom, derived, effect } from "./streams";
import { resolve, isObject, isSourceStream, isStream } from "./util";

const resolveSource = (x) => {
  if (isSourceStream(x)) return x;
  if (isStream(x)) return resolveSource(x.get());
  return x;
};

const readVars = (node, getVar, first = true) => {
  if (isObject(node)) {
    if (node.type === "value") {
      for (const name of node.vars.filter((n) => n[0] !== "$")) getVar(name);
      for (const v of node.values) readVars(v, getVar, false);
    } else if (node.type === "func") {
      readVars(node.body, getVar, false);
    } else if (
      ["block", "brackets", "object", "array"].includes(node.type) &&
      (!node.capture || first)
    ) {
      for (const item of node.items.filter((n) => isObject(n))) {
        if (item.type === "merge") {
          if (isSourceStream(resolveSource(getVar(item.key, false)))) {
            readVars(item.value, getVar, false);
          }
        } else if (["assign", "unpack"].includes(item.type)) {
          readVars(item.value, getVar, false);
        } else {
          readVars(item, getVar, false);
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

  const { type, capture, items } = node;
  return derived(() => {
    const assignItems = items
      .filter((n) => isObject(n) && n.type === "assign" && !n.root)
      .reduce(
        (res, { recursive, key, value }) => ({
          ...res,
          [key]: { recursive, value },
        }),
        {}
      );
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

    const newGetVar = (name, captureUndef = capture ? true : undefined) => {
      if (values.hasOwnProperty(name)) return values[name];
      if (assignItems[name]) {
        return (values[name] = compileNode(assignItems[name].value, (n, c) =>
          n !== name || assignItems[name].recursive
            ? newGetVar(n, c)
            : partialValues.hasOwnProperty(n)
            ? partialValues[n]
            : getVar(n, c)
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

    const root = items
      .filter((n) => isObject(n) && n.type === "assign" && n.root)
      .reduce(
        (res, { key, value }) => ({
          ...res,
          [key]: compileNode(value, newGetVar),
        }),
        {}
      );

    const content = partialContent.map((x) =>
      x.compiled ? x.value : compileNode(x.value, newGetVar)
    );

    for (const { key, value } of mergeItems.filter((n) => n.value)) {
      const target = resolveSource(newGetVar(key, false));
      if (isSourceStream(target)) {
        const source = compileNode(value, newGetVar);
        effect(() => {
          const res = resolve(source, true);
          if (res !== undefined) target.set(res);
        }, `merge ${key}`);
      }
    }

    if (type === "block") {
      return { type: "block", values, items: content, ...root };
    }
    if (type === "object") return values;
    if (type === "array") return content;
    if (type === "brackets") return content[content.length - 1];
    return null;
  }, "block");
};

export default compileNode;
