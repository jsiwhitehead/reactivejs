import run, { atom, get } from "./index";

run(
  () => {
    const tick = atom(0);
    setInterval(() => {
      tick.set(tick.get() + 1);
    }, 1000);
    return { tick };
  },
  `tick; (tick + 1)`,
  (data) => {
    console.log(JSON.stringify(get(data, true), null, 2));
  }
);
