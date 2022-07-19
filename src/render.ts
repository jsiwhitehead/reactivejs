import { elementOpen, elementClose, patch, text } from "incremental-dom";

import { isReactive, resolve } from "./compile";

const isObject = (x) => Object.prototype.toString.call(x) === "[object Object]";

const kebabToCamel = (s) => {
  let v = s;
  if (v[0] === "-") {
    v = v.slice(1);
    if (!v.startsWith("ms-")) v = `${v[0].toUpperCase()}${v.slice(1)}`;
  }
  return v
    .split("-")
    .map((x, i) => (i === 0 ? x : `${x[0].toUpperCase()}${x.slice(1)}`))
    .join("");
};

const render = (data) => {
  if (!isObject(data) || !data.items) {
    return text(
      typeof data === "string" ? data : JSON.stringify(resolve(data, true))
    );
  }

  const content = data.items.map((d) => resolve(d));

  const values = resolve(data.values, true);
  const setters = Object.keys(data.values)
    .filter((k) => isReactive(data.values[k]) && k.startsWith("on"))
    .reduce(
      (res, k) => ({
        ...res,
        [k]: (e) => {
          data.values[k].set(e);
        },
      }),
      {}
    );
  const props = {
    ...values,
    style:
      values.style &&
      Object.keys(values.style)
        .filter((k) => values.style[k] != null)
        .reduce(
          (res, k) => ({ ...res, [kebabToCamel(k)]: values.style[k] }),
          {}
        ),
    ...setters,
  };

  elementOpen(
    resolve(data.tag),
    null,
    null,
    ...Object.keys(props).reduce((res, k) => [...res, k, props[k]], [] as any[])
  );

  content.forEach((c) => render(c));

  elementClose(resolve(data.tag));
};

export default (root) => (data) => patch(root, render, resolve(data));

// const attributesMap = {
//   accesskey: "accessKey",
//   bgcolor: "bgColor",
//   class: "className",
//   colspan: "colSpan",
//   contenteditable: "contentEditable",
//   crossorigin: "crossOrigin",
//   dirname: "dirName",
//   inputmode: "inputMode",
//   ismap: "isMap",
//   maxlength: "maxLength",
//   minlength: "minLength",
//   novalidate: "noValidate",
//   readonly: "readOnly",
//   referrerpolicy: "referrerPolicy",
//   rowspan: "rowSpan",
//   tabindex: "tabIndex",
// };
