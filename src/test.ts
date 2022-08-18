import run, { atom, resolve } from "./index";

const tick = atom(1);
setInterval(() => {
  tick.update((x) => x + 1);
}, 1000);

run({ tick }, `tick * tick`, (data) => {
  console.log(JSON.stringify(resolve(data, true), null, 2));
});
