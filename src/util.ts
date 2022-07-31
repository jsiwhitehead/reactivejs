import { createMemo, createSignal } from "./signal";

export const isObject = (x) =>
  Object.prototype.toString.call(x) === "[object Object]";

export const mapObject = (obj, map) =>
  Object.keys(obj).reduce((res, k) => ({ ...res, [k]: map(obj[k], k) }), {});

export const createReactive = (initial?) => {
  const [get, set] = createSignal(initial, { equals: false });
  Object.assign(get, { isReactive: true, set });
  return get as any;
};

export const createDerived = (func, alwaysTrigger = false) => {
  const result = createMemo(func, null, {
    equals: alwaysTrigger ? false : undefined,
  });
  Object.assign(result, { isReactive: true });
  return result;
};

export const isReactive = (x) => typeof x === "function" && x.isReactive;

export const resolve = (node, deep = false) => {
  if (isReactive(node)) return resolve(node(), deep);
  if (!deep) return node;
  if (Array.isArray(node)) return node.map((x) => resolve(x, true));
  if (isObject(node)) return mapObject(node, (x) => resolve(x, true));
  return node;
};
