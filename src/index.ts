import render from "./render";
import compile from "./compile";
import { createSignal, createEffect, createRoot } from "./signal";

const update = render(document.getElementById("app"));

createRoot(() => {
  const [tick, setTick] = createSignal(1);
  Object.assign(tick, { isReactive: true });
  setInterval(() => {
    setTick(tick() + 1);
  }, 1000);

  const x = compile(
    `
    (
      value:: ,
      count:: 0,
      <div
        hover::{onmouseenter; true}
        hover::{onmouseleave; false}
        count::{onclick; (count + 1)}
        style={{
          color: hover ? "red" : "blue",
          background: "lightblue",
          padding: "50px",
        }}
      >
        <div>Count: {count}, Value: {value}, Tick: {tick}</div>
        <input type="text" value::{oninput?.target?.value}/>
      </div>
    )
    `,
    { tick }
  );

  createEffect(() => {
    update(x);
  });
});
