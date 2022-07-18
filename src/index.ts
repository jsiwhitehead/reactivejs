import render from "./render";
import compile, { createReactive } from "./compile";
import { createEffect, createRoot } from "./signal";

const update = render(document.getElementById("app"));

createRoot(() => {
  const tick = createReactive(1);
  setInterval(() => {
    tick.set(tick() + 1);
  }, 1000);

  const x = compile(
    `
    (
      value:: 10,
      value:: tick; value + 10,
      value,
    )
    `,
    // `
    // (
    //   map: (x)=> (
    //     px: (v)=> typeof v === 'number' ? v + 'px' : (v ?? 0),
    //     size: 20,
    //     line: 1.5,
    //     ...x,
    //     lineHeight: line > 3 ? line : line * size,
    //     gap: (lineHeight - size) * 0.5 + 1,
    //     <div
    //       style={{
    //         font-size: px(size),
    //         line-height: px(lineHeight),
    //         font-family: font,
    //         font-weight: bold && 'bold',
    //         font-style: italic && 'italic',
    //         text-decoration: (underline && 'underline') ?? (strike && 'strike'),
    //         text-transform: uppercase && 'uppercase',
    //         text-align: align,
    //         color: color,
    //         text-indent: indent && px(indent),
    //         padding:
    //           Array.isArray(pad) ?
    //             px(pad[0]) + ' ' +
    //             (px(pad[3] ?? pad[1] ?? pad[0])) + ' ' +
    //             (px(pad[2] ?? pad[0])) + ' ' +
    //             (px(pad[1] ?? pad[0])) :
    //           typeof pad === 'object' ?
    //             px(pad.top) + ' ' +
    //             px(pad.right) + ' ' +
    //             px(pad.bottom) + ' ' +
    //             px(pad.left) :
    //           px(pad),
    //         background: fill,
    //       }}
    //       hover::{2}
    //     >Hello!{hover}</div>
    //   ),
    //   map((test:: 1, <div color={test ? "red" : "blue"} hover={test} />))
    // )
    // `,
    { tick, Array: Array }
  );

  createEffect(() => {
    update(x);
  });
});

// <div
//         hover::{onmouseenter; true}
//         hover::{onmouseleave; false}
//         count::{onclick; (count + 1)}
//         style={{
//           color: hover ? "red" : "blue",
//           background: "lightblue",
//           padding: "50px",
//         }}
//       >
//         <div>Count: {count}, Value: {value}, Tick: {tick}</div>
//         <input type="text" value::{oninput?.target?.value}/>
//       </div>
