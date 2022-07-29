import compileNode from "./compile";
import parse from "./parse";
import { createEffect, createRoot } from "./signal";
export { createReactive, isReactive, resolve } from "./util";

const compile = (source, getVar) => {
  if (typeof source === "string") return compileNode(parse(source), getVar);
  const values = {};
  const newGetVar = (name) => {
    if (values[name] !== undefined) return values[name];
    if (source[name]) return (values[name] = compile(source[name], newGetVar));
    return getVar(name);
  };
  for (const name of Object.keys(source)) newGetVar(name);
  return values;
};

export default (source, library, update) => {
  createRoot(() => {
    const compiled = compile(source, (name) => library[name] || null);
    createEffect(() => {
      update(compiled);
    });
  });
};
