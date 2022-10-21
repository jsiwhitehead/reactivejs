import compileNode from "./compile";
import parse from "./parse";
import run from "./streams";

export { reactiveFunc } from "./code";
export { atom, derived, effect } from "./streams";
export { resolve } from "./util";

const combine = (source) => {
  if (typeof source === "string") return source;
  return `{ ${Object.entries(source)
    .map(([k, v]) => `${k}: ${combine(v)}`)
    .join(", ")} }`;
};

export default (library, source, update) => {
  const compiled = compileNode(parse(combine(source), library), library);
  run(() => {
    update(compiled);
  });
};
