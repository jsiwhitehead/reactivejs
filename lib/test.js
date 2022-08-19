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
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importStar(require("./index"));
const print = (x, space) => JSON.stringify(x, (_, v) => {
    if (v === undefined)
        return "__undefined__";
    if (v !== v)
        return "__NaN__";
    return v;
}, space && 2)
    .replace(/"__undefined__"/g, "undefined")
    .replace(/"__NaN__"/g, "NaN");
const tick = (0, index_1.atom)(1);
setInterval(() => {
    tick.update((x) => x + 1);
}, 1000);
(0, index_1.default)({ tick }, `{ x:: [...x, tick] }`, (data) => {
    console.log(print((0, index_1.resolve)(data, true)));
});
//# sourceMappingURL=test.js.map