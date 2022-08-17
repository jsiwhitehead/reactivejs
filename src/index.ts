import compileNode from "./compile";
import parse from "./parse";
import run from "./streams";

const compile = (createData, create, source, getVar) => {
  if (typeof source === "string") {
    return compileNode(createData, create, parse(source), getVar);
  }
  const values = {};
  const newGetVar = (name) => {
    if (values[name] !== undefined) {
      return values[name];
    }
    if (source[name]) {
      return (values[name] = compile(
        createData,
        create,
        source[name],
        newGetVar
      ));
    }
    return getVar(name);
  };
  for (const name of Object.keys(source)) newGetVar(name);
  return values;
};

export default (source, library, update) => {
  run((createData, create) => {
    const lib = library(createData);
    const compiled = compile(createData, create, source, (name) => lib[name]);
    return (get) => {
      update(compiled, get);
    };
  });
};
