import run from "./index";

run(
  `tick; (tick + 1)`,
  (createData) => {
    const tick = createData(0);
    setInterval(() => {
      tick.set(tick.get() + 1);
    }, 1000);
    return { tick };
  },
  (data, get) => {
    console.log(JSON.stringify(get(data, true), null, 2));
  }
);
