import compileNode from "./compile";
import parse from "./parse";
import run, { resolve } from "./streams";

export { reactiveFunc } from "./code";
export { atom, derived, effect, resolve } from "./streams";

const combine = (source) => {
  if (typeof source === "string") return source;
  return `{ ${Object.entries(source)
    .map(([k, v]) => `${k}: ${combine(v)}`)
    .join(", ")} }`;
};

export default (library, source, update?) => {
  const compiled = compileNode(parse(combine(source), library), library);
  if (update) return run(() => update(compiled));
  return run(() => resolve(compiled, true), true);
};
