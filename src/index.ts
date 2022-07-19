import render from "./render";
import run, { createReactive, resolveSingle } from "./compile";

const tick = createReactive(1);
setInterval(() => {
  tick.set(tick() + 1);
}, 1000);

run(
  `
  (
    px: (v)=> typeof v === 'number' ? v + 'px' : v,
    map: (x)=> !isObject(x) ? x : (
      ...x.values,
      size: x.size || 20,
      line: x.line || 1.5,
      lineHeight: line > 3 ? line : line * size,
      gap: (lineHeight - size) * 0.5 + 1,
      <div
        style={{
          font-size: px(size),
          line-height: px(lineHeight),
          font-family: font,
          font-weight: bold && 'bold',
          font-style: italic && 'italic',
          text-decoration: (underline && 'underline') ?? (strike && 'strike'),
          text-transform: uppercase && 'uppercase',
          text-align: align,
          color: color,
          text-indent: px(indent),
          padding:
            isArray(pad) ?
              px(pad[0]) + ' ' +
              (px(pad[3] ?? pad[1] ?? pad[0])) + ' ' +
              (px(pad[2] ?? pad[0])) + ' ' +
              (px(pad[1] ?? pad[0])) :
            typeof pad === 'object' ?
              px(pad.top) + ' ' +
              px(pad.right) + ' ' +
              px(pad.bottom) + ' ' +
              px(pad.left) :
            px(pad),
          background: fill,
        }}
        hover::{onmouseenter; true}
        hover::{onmouseleave; false}
        focus::{onfocus; true}
        focus::{onblur; false}
      >{...mapArray(x.items, map)}</div>
    ),
    map(<a color={hover ? "red" : "blue"}>Hi</a>)
  )
  `,
  {
    tick,
    isArray: (x) => {
      const v = resolveSingle(x);
      const res = Array.isArray(v);
      return res;
    },
    isObject: (x) =>
      Object.prototype.toString.call(resolveSingle(x)) === "[object Object]",
    mapArray: (value, func) => {
      const v = resolveSingle(value) || [];
      return v.map((x) => func(x));
    },
  },
  render(document.getElementById("app"))
);

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
