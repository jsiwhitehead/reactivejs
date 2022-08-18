"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const streams_1 = require("./streams");
const util_1 = require("./util");
const doMember = (obj, prop) => {
    const res = obj[prop];
    return typeof res === "function" ? res.bind(obj) : res;
};
const doCall = (func, args) => {
    if (func.reactiveFunc || func.name === "bound map")
        return func(...args);
    return func(...args.map((a) => {
        const v = (0, util_1.get)(a, true);
        return typeof v === "function" ? (...x) => (0, util_1.get)(v(...x), true) : v;
    }));
};
const compileNode = (node, getVar, noTrack) => {
    if (typeof node === "string")
        return node;
    if (node.type === "value") {
        const compiled = [];
        const getValue = (name) => {
            if (name[0] === "$") {
                const index = parseInt(name.slice(1), 10);
                if (!compiled[index]) {
                    compiled[index] = compileNode(node.values[index], getVar, noTrack);
                }
                return compiled[index];
            }
            if (name === noTrack) {
                return (0, streams_1.derived)(() => (0, util_1.get)(getVar(name), true, true));
            }
            return getVar(name);
        };
        const func = Function(`"use strict";
      return (getValue, doMember, doCall, resolve, resolveDeep) => {
        ${node.code}
      };`)();
        if (!node.hasResolve)
            return func(getValue, doMember, doCall);
        return (0, streams_1.derived)(() => func(getValue, doMember, doCall, util_1.get, (x) => (0, util_1.get)(x, true)));
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
    return compileBlock(node, getVar, noTrack);
};
const compileBlock = ({ type, tag, items }, getVar, noTrack) => {
    const result = () => {
        const values = {};
        const partialValues = {};
        const partialContent = [];
        for (const n of items.filter((n) => !((0, util_1.isObject)(n) && ["assign", "merge"].includes(n.type)))) {
            if ((0, util_1.isObject)(n) && n.type === "unpack") {
                const v = (0, util_1.get)(compileNode(n.value, getVar, noTrack));
                const block = (0, util_1.isObject)(v)
                    ? v.type === "block"
                        ? v
                        : { values: v }
                    : { items: v };
                Object.assign(values, block.values || {});
                Object.assign(partialValues, block.values || {});
                partialContent.push(...(block.items || []).map((x) => ({ compiled: true, value: x })));
            }
            else {
                partialContent.push({ compiled: false, value: n });
            }
        }
        const assignItems = items
            .filter((n) => (0, util_1.isObject)(n) && n.type === "assign")
            .reduce((res, { key, value }) => ({ ...res, [key]: value }), {});
        const newGetVar = (name, captureUndef = type === "block" ? true : undefined) => {
            if (values[name] !== undefined)
                return values[name];
            if (assignItems[name]) {
                return (values[name] = compileNode(assignItems[name], (n, c) => n === name &&
                    !(assignItems[name].length === 1 &&
                        assignItems[name][0].type === "func")
                    ? partialValues[n] !== undefined
                        ? partialValues[n]
                        : getVar(n, c)
                    : newGetVar(n, c), noTrack));
            }
            const res = getVar(name, captureUndef ? false : captureUndef);
            if (res === undefined && captureUndef) {
                return (values[name] = (0, streams_1.atom)());
            }
            return res;
        };
        for (const name of Object.keys(assignItems))
            delete values[name];
        for (const name of Object.keys(assignItems))
            newGetVar(name);
        const mergeItems = items.filter((n) => (0, util_1.isObject)(n) && n.type === "merge");
        for (const { key, value } of mergeItems) {
            if (!value || !getVar(key, false))
                values[key] = (0, streams_1.atom)();
        }
        for (const { key, value } of mergeItems.filter((n) => n.value)) {
            const source = compileNode(value, newGetVar, key);
            let first = (0, util_1.isObject)(value) && value.type === "value" && value.multi;
            const target = newGetVar(key);
            (0, util_1.get)((0, streams_1.derived)(() => {
                const res = (0, util_1.get)(source, true);
                if (!first)
                    target(res);
                first = false;
            }));
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
    if (items.some((n) => (0, util_1.isObject)(n) && ["merge", "unpack"].includes(n.type))) {
        return (0, streams_1.derived)(result);
    }
    return result();
};
exports.default = compileNode;
//# sourceMappingURL=compile.js.map