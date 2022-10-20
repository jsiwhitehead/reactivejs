export const isStream = (x) => x && typeof x === "object" && x.isStream;
export const isSourceStream = (x) => isStream(x) && x.set;

export const resolve = (x, deep = false) => {
  if (!x) return x;
  if (Array.isArray(x)) {
    if (!deep) return x;
    return x.map((y) => resolve(y, true));
  }
  if (typeof x === "object") {
    if (x.isStream) return resolve(x.get(), deep);
    if (!deep) return x;
    return Object.fromEntries(
      Object.entries(x).map(([k, y]) => [k, resolve(y, true)])
    );
  }
  return x;
};
