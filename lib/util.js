"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapObject = exports.isObject = void 0;
const isObject = (x) => Object.prototype.toString.call(x) === "[object Object]";
exports.isObject = isObject;
const mapObject = (obj, map) => Object.keys(obj).reduce((res, k) => ({ ...res, [k]: map(obj[k], k) }), {});
exports.mapObject = mapObject;
//# sourceMappingURL=util.js.map