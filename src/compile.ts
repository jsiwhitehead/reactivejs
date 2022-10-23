import { reactiveFunc } from "./code";
import {
  atom,
  derived,
  effect,
  isSourceStream,
  isStream,
  resolve,
} from "./streams";

const resolveSource = (x) => {
  if (isSourceStream(x)) return x;
  if (isStream(x)) return resolveSource(x.get());
  return x;
};

const compileNode = (node, context) => {
  if (node.type === "value") {
    const compiled = [] as any[];
    return node.run((name) => {
      if (name[0] === "$") {
        const index = parseInt(name.slice(1), 10);
        if (!compiled[index]) {
          compiled[index] = compileNode(node.nodes[index], context);
        }
        return compiled[index];
      }
      return context[name];
    });
  }

  if (node.type === "func") {
    const result = reactiveFunc((...args) => {
      return compileNode(node.nodes[0], {
        ...context,
        ...Object.fromEntries(node.args.map((name, i) => [name, args[i]])),
      });
    });
    Object.defineProperty(result, "length", { value: node.args.length });
    return result;
  }

  const {
    type,
    assignNodes,
    sourceNodes,
    mergeNodes,
    rootNodes,
    contentNodes,
  } = node;
  return derived(() => {
    const newContext = { ...context };
    const assignValues = {};
    for (const depends in sourceNodes) {
      if (!depends || isSourceStream(resolveSource(newContext[depends]))) {
        for (const n of sourceNodes[depends]) {
          const result = atom(null);
          newContext[n.key] = result;
          assignValues[n.key] = result;
        }
      }
    }
    for (const n of assignNodes) {
      const result = n.source
        ? atom(null)
        : compileNode(n.nodes[0], n.recursive ? newContext : { ...newContext });
      newContext[n.key] = result;
      assignValues[n.key] = result;
    }

    for (const { key, nodes, source } of [
      ...mergeNodes,
      ...assignNodes.filter((n) => n.source && n.nodes[0]),
    ]) {
      if (key in newContext) {
        const target = resolveSource(newContext[key]);
        if (isSourceStream(target)) {
          const input = compileNode(nodes[0], newContext);
          let skipFirst = source;
          effect(() => {
            const res = resolve(input, true);
            if (!skipFirst && res !== undefined) target.set(res);
            skipFirst = false;
          }, `merge ${key}`);
        }
      }
    }

    const root = Object.fromEntries(
      rootNodes.map(({ key, nodes }) => [
        key,
        compileNode(nodes[0], newContext),
      ])
    );

    const unpackValues = {};
    const partialContent = [] as any[];
    for (const n of contentNodes) {
      if (n.type === "unpack") {
        const value = resolve(compileNode(n.nodes[0], context));
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
