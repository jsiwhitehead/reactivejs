"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const code_1 = require("./code");
const streams_1 = require("./streams");
const util_1 = require("./util");
const resolveSource = (x) => {
    if ((0, util_1.isSourceStream)(x))
        return x;
    if ((0, util_1.isStream)(x))
        return resolveSource(x.get());
    return x;
};
const memoNewGetVar = (newGetVar) => {
    const captureUndefMemo = {};
    const noCaptureUndefMemo = {};
    return (name, captureUndef) => {
        const memo = captureUndef ? captureUndefMemo : noCaptureUndefMemo;
        if (name in memo)
            return memo[name];
        return (memo[name] = newGetVar(name, captureUndef));
    };
};
const readVars = (node, getVar, first = true) => {
    if (node.type === "value") {
        for (const name of node.vars.filter((n) => n[0] !== "$"))
            getVar(name);
        for (const v of node.values)
            readVars(v, getVar, false);
    }
    else if (node.type === "func") {
        readVars(node.body, getVar, false);
    }
    else if (node.type === "merge") {
        if ((0, util_1.isSourceStream)(resolveSource(getVar(node.key, false)))) {
            readVars(node.value, getVar, false);
        }
    }
    else if (["assign", "unpack"].includes(node.type)) {
        readVars(node.value, getVar, false);
    }
    else if (["block", "brackets", "object", "array"].includes(node.type) &&
        (!node.capture || first)) {
        for (const item of node.items)
            readVars(item, getVar, false);
    }
};
const compileNode = (node, getVar) => {
    if (node.type === "string")
        return node.value;
    if (node.type === "value") {
        const compiled = [];
        return node.run((name) => {
            if (name[0] === "$") {
                const index = parseInt(name.slice(1), 10);
                if (!compiled[index]) {
                    compiled[index] = compileNode(node.values[index], getVar);
                }
                return compiled[index];
            }
            return getVar(name);
        });
    }
    if (node.type === "func") {
        const argsIndicies = node.args.reduce((res, k, i) => ({ ...res, [k]: i }), {});
        const result = (0, code_1.reactiveFunc)((...args) => {
            const newGetVar = memoNewGetVar((name, captureUndef) => {
                if (name in argsIndicies)
                    return args[argsIndicies[name]];
                return getVar(name, captureUndef);
            });
            return compileNode(node.body, newGetVar);
        });
        Object.defineProperty(result, "length", { value: node.args.length });
        return result;
    }
    const { type, capture, items } = node;
    return (0, streams_1.derived)(() => {
        const assignItems = items
            .filter((n) => n.type === "assign" && !n.root)
            .reduce((res, { recursive, key, value }) => ({
            ...res,
            [key]: { recursive, value },
        }), {});
        const contentItems = items.filter((n) => !["assign", "merge"].includes(n.type));
        const mergeItems = items.filter((n) => n.type === "merge");
        const values = {};
        const partialValues = {};
        const partialContent = [];
        for (const n of contentItems) {
            if (n.type === "unpack") {
                const value = (0, util_1.resolve)(compileNode(n.value, getVar));
                if (Array.isArray(value)) {
                    partialContent.push(...value.map((x) => ({ compiled: true, value: x })));
                }
                else if (typeof value === "object" && value !== null) {
                    if (value.type === "block" && type === "block") {
                        Object.assign(values, value.values);
                        Object.assign(partialValues, value.values);
                        partialContent.push(...value.items.map((x) => ({ compiled: true, value: x })));
                    }
                    else {
                        Object.assign(values, value);
                        Object.assign(partialValues, value);
                    }
                }
            }
            else {
                partialContent.push({ compiled: false, value: n });
            }
        }
        const newGetVar = memoNewGetVar((name, captureUndef = capture ? true : undefined) => {
            if (name in values)
                return values[name];
            if (assignItems[name]) {
                return (values[name] = compileNode(assignItems[name].value, (n, c) => n !== name || assignItems[name].recursive
                    ? newGetVar(n, c)
                    : n in partialValues
                        ? partialValues[n]
                        : getVar(n, c)));
            }
            const res = getVar(name, captureUndef ? false : captureUndef);
            if (res === undefined && captureUndef)
                return (values[name] = (0, streams_1.atom)(null));
            return res;
        });
        for (const name of Object.keys(assignItems))
            delete values[name];
        for (const name of Object.keys(assignItems))
            newGetVar(name);
        for (const { key } of mergeItems.filter((n) => n.source)) {
            values[key] = (0, streams_1.atom)(null);
        }
        readVars(node, newGetVar);
        const root = items
            .filter((n) => n.type === "assign" && n.root)
            .reduce((res, { key, value }) => ({
            ...res,
            [key]: compileNode(value, newGetVar),
        }), {});
        const content = partialContent.map((x) => x.compiled ? x.value : compileNode(x.value, newGetVar));
        for (const { key, value, source } of mergeItems.filter((n) => n.value)) {
            const target = resolveSource(newGetVar(key, false));
            if ((0, util_1.isSourceStream)(target)) {
                const input = compileNode(value, newGetVar);
                let skipFirst = source;
                (0, streams_1.effect)(() => {
                    const res = (0, util_1.resolve)(input, true);
                    if (!skipFirst && res !== undefined)
                        target.set(res);
                    skipFirst = false;
                }, `merge ${key}`);
            }
        }
        if (type === "block") {
            return { type: "block", values, items: content, ...root };
        }
        if (type === "object")
            return values;
        if (type === "array")
            return content;
        if (type === "brackets")
            return content[content.length - 1];
        return null;
    }, "block");
};
exports.default = compileNode;
//# sourceMappingURL=compile.js.map