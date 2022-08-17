import run, { atom, get } from "./index";

run(
  `tick; (tick + 1)`,
  () => {
    const tick = atom(0);
    setInterval(() => {
      tick.set(tick.get() + 1);
    }, 1000);
    return { tick };
  },
  (data) => {
    console.log(JSON.stringify(get(data, true), null, 2));
  }
);
