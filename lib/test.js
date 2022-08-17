"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("./index"));
(0, index_1.default)(`tick; (tick + 1)`, (createData) => {
    const tick = createData(0);
    setInterval(() => {
        tick.set(tick.get() + 1);
    }, 1000);
    return { tick };
}, (data, get) => {
    console.log(JSON.stringify(get(data, true), null, 2));
});
//# sourceMappingURL=test.js.map