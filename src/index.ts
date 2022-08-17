import compileNode from "./compile";
import parse from "./parse";
import run from "./streams";

export { atom, derived, get } from "./streams";

const compile = (source, getVar) => {
  if (typeof source === "string") {
    return compileNode(parse(source), getVar);
  }
  const values = {};
  const newGetVar = (name) => {
    if (values[name] !== undefined) {
      return values[name];
    }
    if (source[name]) {
      return (values[name] = compile(source[name], newGetVar));
    }
    return getVar(name);
  };
  for (const name of Object.keys(source)) newGetVar(name);
  return values;
};

export default (source, library, update) => {
  run(() => {
    const lib = library();
    const compiled = compile(source, (name) => lib[name]);
    return () => {
      update(compiled);
    };
  });
};
