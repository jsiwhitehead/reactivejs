"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolve = exports.effect = exports.derived = exports.atom = exports.reactiveFunc = void 0;
const compile_1 = __importDefault(require("./compile"));
const parse_1 = __importDefault(require("./parse"));
const streams_1 = __importDefault(require("./streams"));
var code_1 = require("./code");
Object.defineProperty(exports, "reactiveFunc", { enumerable: true, get: function () { return code_1.reactiveFunc; } });
var streams_2 = require("./streams");
Object.defineProperty(exports, "atom", { enumerable: true, get: function () { return streams_2.atom; } });
Object.defineProperty(exports, "derived", { enumerable: true, get: function () { return streams_2.derived; } });
Object.defineProperty(exports, "effect", { enumerable: true, get: function () { return streams_2.effect; } });
var util_1 = require("./util");
Object.defineProperty(exports, "resolve", { enumerable: true, get: function () { return util_1.resolve; } });
const compile = (source, getVar) => {
    if (typeof source === "string")
        return (0, compile_1.default)((0, parse_1.default)(source), getVar);
    const values = {};
    const newGetVar = (name) => {
        if (name in values)
            return values[name];
        if (source[name])
            return (values[name] = compile(source[name], newGetVar));
        return getVar(name);
    };
    for (const name of Object.keys(source))
        newGetVar(name);
    return values;
};
exports.default = (library, source, update) => {
    const compiled = compile(source, (name) => library[name]);
    (0, streams_1.default)(() => {
        update(compiled);
    });
};
//# sourceMappingURL=index.js.map