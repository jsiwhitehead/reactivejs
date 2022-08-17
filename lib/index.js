"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const compile_1 = __importDefault(require("./compile"));
const parse_1 = __importDefault(require("./parse"));
const streams_1 = __importDefault(require("./streams"));
const compile = (createData, create, source, getVar) => {
    if (typeof source === "string") {
        return (0, compile_1.default)(createData, create, (0, parse_1.default)(source), getVar);
    }
    const values = {};
    const newGetVar = (name) => {
        if (values[name] !== undefined) {
            return values[name];
        }
        if (source[name]) {
            return (values[name] = compile(createData, create, source[name], newGetVar));
        }
        return getVar(name);
    };
    for (const name of Object.keys(source))
        newGetVar(name);
    return values;
};
exports.default = (source, library, update) => {
    (0, streams_1.default)((createData, create) => {
        const lib = library(createData);
        const compiled = compile(createData, create, source, (name) => lib[name]);
        return (get) => {
            update(compiled, get);
        };
    });
};
//# sourceMappingURL=index.js.map