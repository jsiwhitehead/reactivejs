"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolve = exports.isSourceStream = exports.isStream = exports.mapObject = exports.isObject = void 0;
const isObject = (x) => Object.prototype.toString.call(x) === "[object Object]";
exports.isObject = isObject;
const mapObject = (obj, map) => Object.keys(obj).reduce((res, k) => ({ ...res, [k]: map(obj[k], k) }), {});
exports.mapObject = mapObject;
const isStream = (x) => (0, exports.isObject)(x) && x.isStream;
exports.isStream = isStream;
const isSourceStream = (x) => (0, exports.isStream)(x) && x.set;
exports.isSourceStream = isSourceStream;
const resolve = (x, deep = false) => {
    if ((0, exports.isStream)(x))
        return (0, exports.resolve)(x.get(), deep);
    if (!deep)
        return x;
    if (Array.isArray(x))
        return x.map((y) => (0, exports.resolve)(y, true));
    if ((0, exports.isObject)(x))
        return (0, exports.mapObject)(x, (y) => (0, exports.resolve)(y, true));
    return x;
};
exports.resolve = resolve;
//# sourceMappingURL=util.js.map