"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolve = exports.isSourceStream = exports.isStream = void 0;
const isStream = (x) => x && typeof x === "object" && x.isStream;
exports.isStream = isStream;
const isSourceStream = (x) => (0, exports.isStream)(x) && x.set;
exports.isSourceStream = isSourceStream;
const resolve = (x, deep = false) => {
    if (!x)
        return x;
    if (Array.isArray(x)) {
        if (!deep)
            return x;
        return x.map((y) => (0, exports.resolve)(y, true));
    }
    if (typeof x === "object") {
        if (x.isStream)
            return (0, exports.resolve)(x.get(), deep);
        if (!deep)
            return x;
        return Object.fromEntries(Object.entries(x).map(([k, y]) => [k, (0, exports.resolve)(y, true)]));
    }
    return x;
};
exports.resolve = resolve;
//# sourceMappingURL=util.js.map