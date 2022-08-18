import compileNode from "./compile";
import parse from "./parse";
import run from "./streams";

export { atom, derived, stream } from "./streams";
export { resolve } from "./util";

const compile = (source, getVar) => {
  if (typeof source === "string") return compileNode(parse(source), getVar);
  const values = {};
  const newGetVar = (name) => {
    if (values.hasOwnProperty(name)) return values[name];
    if (source[name]) return (values[name] = compile(source[name], newGetVar));
    return getVar(name);
  };
  for (const name of Object.keys(source)) newGetVar(name);
  return values;
};

export default (library, source, update) => {
  run(() => {
    const compiled = compile(source, (name) => library[name]);
    return () => {
      update(compiled);
    };
  });
};
