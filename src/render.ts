import { elementOpen, elementClose, patch, text } from "incremental-dom";

import { createRoot } from "./signal";
import { isObject, isReactive, resolve, resolveSingle } from "./compile";

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
  if (!isObject(data)) return text(data);

  if (!data.items) {
    return text(JSON.stringify(resolve(data), null, 2));
  }

  const content = data.items.map((d) => resolveSingle(d));

  const values = resolve(data.values);
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
      Object.keys(values.style).reduce(
        (res, k) => ({ ...res, [kebabToCamel(k)]: values.style[k] }),
        {}
      ),
    ...setters,
  };

  elementOpen(
    resolveSingle(data.tag),
    null,
    null,
    ...Object.keys(props).reduce((res, k) => [...res, k, props[k]], [] as any[])
  );

  content.forEach((c) => render(c));

  elementClose(resolveSingle(data.tag));
};

export default (root) =>
  createRoot(() => (data) => patch(root, render, resolveSingle(data)));

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
