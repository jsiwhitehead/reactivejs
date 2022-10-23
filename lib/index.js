"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolve = exports.effect = exports.derived = exports.atom = exports.reactiveFunc = void 0;
const compile_1 = __importDefault(require("./compile"));
const parse_1 = __importDefault(require("./parse"));
const streams_1 = __importStar(require("./streams"));
var code_1 = require("./code");
Object.defineProperty(exports, "reactiveFunc", { enumerable: true, get: function () { return code_1.reactiveFunc; } });
var streams_2 = require("./streams");
Object.defineProperty(exports, "atom", { enumerable: true, get: function () { return streams_2.atom; } });
Object.defineProperty(exports, "derived", { enumerable: true, get: function () { return streams_2.derived; } });
Object.defineProperty(exports, "effect", { enumerable: true, get: function () { return streams_2.effect; } });
Object.defineProperty(exports, "resolve", { enumerable: true, get: function () { return streams_2.resolve; } });
const combine = (source) => {
    if (typeof source === "string")
        return source;
    return `{ ${Object.entries(source)
        .map(([k, v]) => `${k}: ${combine(v)}`)
        .join(", ")} }`;
};
exports.default = (library, source, update) => {
    const compiled = (0, compile_1.default)((0, parse_1.default)(combine(source), library), library);
    if (update)
        return (0, streams_1.default)(() => update(compiled));
    return (0, streams_1.default)(() => (0, streams_1.resolve)(compiled, true), true);
};
//# sourceMappingURL=index.js.map