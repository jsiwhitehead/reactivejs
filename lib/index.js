"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.get = exports.stream = exports.derived = exports.atom = void 0;
const compile_1 = __importDefault(require("./compile"));
const parse_1 = __importDefault(require("./parse"));
const streams_1 = __importDefault(require("./streams"));
var streams_2 = require("./streams");
Object.defineProperty(exports, "atom", { enumerable: true, get: function () { return streams_2.atom; } });
Object.defineProperty(exports, "derived", { enumerable: true, get: function () { return streams_2.derived; } });
Object.defineProperty(exports, "stream", { enumerable: true, get: function () { return streams_2.stream; } });
var util_1 = require("./util");
Object.defineProperty(exports, "get", { enumerable: true, get: function () { return util_1.get; } });
const compile = (source, getVar) => {
    if (typeof source === "string") {
        return (0, compile_1.default)((0, parse_1.default)(source), getVar);
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
    for (const name of Object.keys(source))
        newGetVar(name);
    return values;
};
exports.default = (library, source, update) => {
    (0, streams_1.default)(() => {
        const lib = library();
        const compiled = compile(source, (name) => lib[name]);
        return () => {
            update(compiled);
        };
    });
};
//# sourceMappingURL=index.js.map