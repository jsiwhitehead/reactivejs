import updateCode from "./code";
import { createComputed, untrack } from "./signal";
import { createDerived, createReactive, isObject, resolve } from "./util";
const compileBlock = ({ type, tag, items }, getVar, noTrack) => {
    const result = () => {
        const values = {};
        const assignItems = items
            .filter((n) => isObject(n) && n.type === "assign")
            .reduce((res, { key, value }) => ({ ...res, [key]: value }), {});
        const newGetVar = (name, captureUndef = type === "block" ? true : undefined) => {
            if (values[name] !== undefined)
                return values[name];
            if (assignItems[name]) {
                return (values[name] = compileNode(assignItems[name], (n, c) => n === name &&
                    !(assignItems[name].length === 1 &&
                        assignItems[name][0].type === "func")
                    ? getVar(n, c)
                    : newGetVar(n, c), noTrack));
            }
            const res = getVar(name, captureUndef ? false : captureUndef);
            if (res === null && captureUndef) {
                return (values[name] = createReactive());
            }
            return res;
        };
        const partialContent = [];
        for (const n of items.filter((n) => !(isObject(n) && ["assign", "merge"].includes(n.type)))) {
            if (isObject(n) && n.type === "unpack") {
                const v = resolve(compileNode(n.value, getVar, noTrack));
                const block = isObject(v)
                    ? v.type === "block"
                        ? v
                        : { values: v }
                    : { items: v };
                Object.assign(values, block.values || {});
                partialContent.push(...(block.items || []).map((x) => ({ compiled: true, value: x })));
            }
            else {
                partialContent.push({ compiled: false, value: n });
            }
        }
        for (const name of Object.keys(assignItems))
            newGetVar(name);
        const mergeItems = items.filter((n) => isObject(n) && n.type === "merge");
        for (const { key, value } of mergeItems) {
            if (!value || !getVar(key))
                values[key] = createReactive();
        }
        for (const { key, value } of mergeItems.filter((n) => n.value)) {
            const source = compileNode(value, newGetVar, key);
            let first = (typeof value === "string" && value.includes(";")) ||
                (Array.isArray(value) &&
                    value.some((v) => typeof v === "string" && v.includes(";")));
            const target = newGetVar(key);
            createComputed(() => {
                const res = resolve(source, true);
                if (!first)
                    target.set(res);
                first = false;
            });
        }
        const content = partialContent.map((x) => x.compiled ? x.value : compileNode(x.value, newGetVar, noTrack));
        if (type === "brackets")
            return content[content.length - 1];
        if (type === "block")
            return { type: "block", tag, values, items: content };
        if (type === "object")
            return values;
        if (type === "array")
            return content;
        return null;
    };
    if (!items.some((n) => isObject(n) && n.type === "unpack"))
        return result();
    return createDerived(result);
};
const compileNode = (node, getVar, noTrack) => {
    if (typeof node === "string")
        return node;
    if (Array.isArray(node)) {
        const { code, hasResolve } = updateCode(node.map((v, i) => (typeof v === "string" ? v : `$${i}`)).join(""));
        const compiled = [];
        const getValue = (name) => {
            if (name[0] === "$") {
                const index = parseInt(name.slice(1), 10);
                if (!compiled[index]) {
                    compiled[index] = compileNode(node[index], getVar, noTrack);
                }
                return compiled[index];
            }
            if (name === noTrack) {
                return untrack(() => resolve(getVar(name), true));
            }
            return getVar(name);
        };
        const func = Function(`"use strict";
      return function(getValue, resolve, resolveDeep) {
        ${code
            .map((c, i) => `${i === code.length - 1 ? "return " : ""}${c};`)
            .join("\n")}
      };`)();
        if (!hasResolve)
            return func(getValue);
        return createDerived(() => func(getValue, resolve, (x) => resolve(x, true)), code.length > 1);
    }
    if (node.type === "func") {
        const result = (...args) => {
            const newGetVar = (name) => {
                const index = node.args.indexOf(name);
                if (index !== -1)
                    return args[index];
                return getVar(name);
            };
            return compileNode(node.body, newGetVar, noTrack);
        };
        Object.assign(result, { reactiveFunc: true });
        return result;
    }
    if (node.type === "index") {
        return createDerived(() => {
            const value = resolve(getVar(node.base));
            const index = resolve(compileNode(node.items[0], getVar, noTrack));
            return value?.[index];
        });
    }
    if (node.type === "call") {
        const base = compileNode([node.base], getVar, noTrack);
        const func = node.path.reduce((res, p) => typeof res?.[p] === "function" ? res?.[p].bind(res) : res?.[p], base);
        const args = node.items.map((x) => compileNode(x, getVar, noTrack));
        if (typeof func !== "function" || !func.reactiveFunc) {
            return createDerived(() => {
                const func = node.path.reduce((res, p, i) => {
                    const next = resolve(res[p]);
                    return i === node.path.length - 1 ? next.bind(res) : next;
                }, resolve(base));
                return func(...args.map((a) => {
                    const v = resolve(a, true);
                    return typeof v === "function"
                        ? (...x) => resolve(a(...x), true)
                        : v;
                }));
            });
        }
        return func(...args);
    }
    return compileBlock(node, getVar, noTrack);
};
export default compileNode;
//# sourceMappingURL=compile.js.map