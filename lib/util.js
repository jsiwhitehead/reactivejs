"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get = exports.mapObject = exports.isObject = void 0;
const isObject = (x) => Object.prototype.toString.call(x) === "[object Object]";
exports.isObject = isObject;
const mapObject = (obj, map) => Object.keys(obj).reduce((res, k) => ({ ...res, [k]: map(obj[k], k) }), {});
exports.mapObject = mapObject;
const get = (x, deep = false, sample = false) => {
    if (typeof x === "object" && x.isStream)
        return (0, exports.get)(x.observe(sample), deep);
    if (!deep)
        return x;
    if (Array.isArray(x))
        return x.map((y) => (0, exports.get)(y, true));
    if ((0, exports.isObject)(x))
        return (0, exports.mapObject)(x, (y) => (0, exports.get)(y, true));
    return x;
};
exports.get = get;
//# sourceMappingURL=util.js.map