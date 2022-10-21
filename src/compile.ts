import { reactiveFunc } from "./code";
import { atom, derived, effect } from "./streams";
import { resolve, isSourceStream, isStream } from "./util";

const resolveSource = (x) => {
  if (isSourceStream(x)) return x;
  if (isStream(x)) return resolveSource(x.get());
  return x;
};

const compileNode = (node, context) => {
  if (node.type === "string") return node.value;

  if (node.type === "value") {
    const compiled = [] as any[];
    return node.run((name) => {
      if (name[0] === "$") {
        const index = parseInt(name.slice(1), 10);
        if (!compiled[index]) {
          compiled[index] = compileNode(node.values[index], context);
        }
        return compiled[index];
      }
      return context[name];
    });
  }

  if (node.type === "func") {
    const result = reactiveFunc((...args) => {
      return compileNode(node.body, {
        ...context,
        ...Object.fromEntries(node.args.map((name, i) => [name, args[i]])),
      });
    });
    Object.defineProperty(result, "length", { value: node.args.length });
    return result;
  }

  const {
    type,
    assignItems,
    sourceItems,
    mergeItems,
    rootItems,
    contentItems,
  } = node;
  return derived(() => {
    const assignValues = {};
    for (const n of assignItems) {
      assignValues[n.key] = n.source
        ? atom(null)
        : compileNode(n.value, { ...context, ...assignValues });
    }

    const assignContext = { ...context, ...assignValues };

    for (const depends in sourceItems) {
      if (!depends || isSourceStream(resolveSource(assignContext[depends]))) {
        for (const n of sourceItems[depends]) {
          assignValues[n.key] = atom(null);
        }
      }
    }

    const newContext = { ...context, ...assignValues };

    for (const { key, value, source } of [
      ...mergeItems,
      ...assignItems.filter((n) => n.source && n.value),
    ]) {
      if (key in newContext) {
        const target = newContext[key];
        const input = compileNode(value, newContext);
        let skipFirst = source;
        effect(() => {
          const res = resolve(input, true);
          if (!skipFirst && res !== undefined) target.set(res);
          skipFirst = false;
        }, `merge ${key}`);
      }
    }

    const root = Object.fromEntries(
      rootItems.map(({ key, value }) => [key, compileNode(value, newContext)])
    );

    const unpackValues = {};
    const partialContent = [] as any[];
    for (const n of contentItems) {
      if (n.type === "unpack") {
        const value = resolve(compileNode(n.value, context));
        if (Array.isArray(value)) {
          partialContent.push(
            ...value.map((x) => ({ compiled: true, value: x }))
          );
        } else if (typeof value === "object" && value !== null) {
          if (value.type === "block" && type === "block") {
            Object.assign(unpackValues, value.values);
            partialContent.push(
              ...value.items.map((x) => ({ compiled: true, value: x }))
            );
          } else {
            Object.assign(unpackValues, value);
          }
        }
      } else {
        partialContent.push({ compiled: false, value: n });
      }
    }

    const values = { ...unpackValues, ...assignValues };
    const content = partialContent.map((x) =>
      x.compiled ? x.value : compileNode(x.value, newContext)
    );

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
