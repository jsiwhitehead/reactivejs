export const isObject = (x) =>
  Object.prototype.toString.call(x) === "[object Object]";

export const mapObject = (obj, map) =>
  Object.keys(obj).reduce((res, k) => ({ ...res, [k]: map(obj[k], k) }), {});

export const isStream = (x) => isObject(x) && x.isStream;
export const isSourceStream = (x) => isStream(x) && x.set;

export const resolve = (x, deep = false) => {
  if (isStream(x)) return resolve(x.get(), deep);
  if (!deep) return x;
  if (Array.isArray(x)) return x.map((y) => resolve(y, true));
  if (isObject(x)) return mapObject(x, (y) => resolve(y, true));
  return x;
};
