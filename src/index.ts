import render from "./render";
import run, { createReactive, resolve } from "./compile";

const isObject = (x) => Object.prototype.toString.call(x) === "[object Object]";

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
      style: {
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
            (px(pad[1] ?? pad[0]))
          : typeof pad === 'object' ?
            px(pad.top) + ' ' +
            px(pad.right) + ' ' +
            px(pad.bottom) + ' ' +
            px(pad.left)
          :
            px(pad),
        background: fill,
      },
      events: {
        onmouseenter:: ,
        onmouseleave:: ,
        hover:: onmouseenter; true,
        hover:: onmouseleave; false,
        onfocus:: ,
        onblur:: ,
        focus:: onfocus; true,
        focus:: onblur; false,
      },
      nextInline: inline || hasValues(x.items),
      content:
        nextInline ?
          mapArray(x.items, (y)=> map(isObject(y) ? <a {...y} span={true}></a> : y))
        :
          mapArray(x.items, map),
      span ?
        <span style={style} {...events}>{...content}</span>
      : nextInline ?
        <div style={style} {...events}>
          <div style={{ padding: "1px 0", min-height: px(size) }}>
            <div style={{ margin-top: px(-gap), margin-bottom: px(-gap) }}>
              {...content}
            </div>
          </div>
        </div>
      : stack ?
        <div style={style} {...events}>
          {...mapArray(content, (c, i)=> <div style={{ padding-top: px(i !== 0 && stack) }}>{c}</div>)}
        </div>
      :
        <div style={style} {...events}>{...content}</div>,
    ),
    map(
      <a stack={10} color={hover ? "red" : "blue"}>
        <a>Hi</a>
        <a>There</a>
      </a>
    )
  )
  `,
  {
    tick,
    isArray: (v) => Array.isArray(resolve(v)),
    isObject: (v) => isObject(resolve(v)),
    mapArray: (v, f) => (resolve(v) || []).map((x, i) => f(x, i)),
    hasValues: (v) => (resolve(v) || []).some((x) => !isObject(resolve(x))),
  },
  render(document.getElementById("app"))
);
