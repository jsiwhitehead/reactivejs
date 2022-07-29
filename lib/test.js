import run, { createReactive, resolve } from "./index";
const tick = createReactive(1);
setInterval(() => {
    tick.set(tick() + 1);
}, 1000);
run(`tick * tick`, { tick }, (data) => console.log(JSON.stringify(resolve(data, true), null, 2)));
//# sourceMappingURL=test.js.map