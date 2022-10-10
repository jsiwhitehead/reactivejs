"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const code_1 = require("./code");
const streams_1 = require("./streams");
const util_1 = require("./util");
const unpackValue = (v) => {
    if ((0, util_1.isObject)(v))
        return v.type === "block" ? v : { values: v, items: [] };
    if (Array.isArray(v))
        return { values: {}, items: v };
    return { values: {}, items: [] };
};
const readVars = (node, getVar, ignoreBlock = false) => {
    if ((0, util_1.isObject)(node)) {
        if (node.type === "value") {
            for (const name of node.vars) {
                if (name[0] !== "$")
                    getVar(name);
            }
        }
        else if (["brackets", "object", "array"].includes(node.type) ||
            (node.type === "block" && !ignoreBlock)) {
            for (const item of node.items) {
                if ((0, util_1.isObject)(item) &&
                    ["merge", "assign", "unpack"].includes(item.type)) {
                    if (item.type !== "merge")
                        readVars(item.value, getVar, true);
                }
                else {
                    readVars(item, getVar, true);
                }
            }
        }
    }
};
const constructBlock = (type, tag, values, items) => {
    if (type === "brackets")
        return items[items.length - 1];
    if (type === "block")
        return { type: "block", tag, values, items };
    if (type === "object")
        return values;
    if (type === "array")
        return items;
    return null;
};
const compileNode = (node, getVar) => {
    if (typeof node === "string")
        return node;
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
        return (0, code_1.reactiveFunc)((...args) => {
            const newGetVar = (name, captureUndef) => {
                const index = node.args.indexOf(name);
                if (index !== -1)
                    return args[index];
                return getVar(name, captureUndef);
            };
            return compileNode(node.body, newGetVar);
        });
    }
    const { type, tag, items } = node;
    const result = () => {
        const assignItems = items
            .filter((n) => (0, util_1.isObject)(n) && n.type === "assign")
            .reduce((res, { key, value }) => ({ ...res, [key]: value }), {});
        const contentItems = items.filter((n) => !((0, util_1.isObject)(n) && ["assign", "merge"].includes(n.type)));
        const mergeItems = items.filter((n) => (0, util_1.isObject)(n) && n.type === "merge");
        const values = {};
        const partialValues = {};
        const partialContent = [];
        for (const n of contentItems) {
            if ((0, util_1.isObject)(n) && n.type === "unpack") {
                const block = unpackValue((0, util_1.resolve)(compileNode(n.value, getVar)));
                Object.assign(values, block.values);
                Object.assign(partialValues, block.values);
                partialContent.push(...block.items.map((x) => ({ compiled: true, value: x })));
            }
            else {
                partialContent.push({ compiled: false, value: n });
            }
        }
        const newGetVar = (name, captureUndef = type === "block" ? true : undefined) => {
            if (values.hasOwnProperty(name))
                return values[name];
            if (assignItems[name]) {
                return (values[name] = compileNode(assignItems[name], (n, c) => n === name &&
                    !(assignItems[name].type === "value" &&
                        assignItems[name].values.length === 1 &&
                        assignItems[name].values[0].type === "func")
                    ? partialValues.hasOwnProperty(n)
                        ? partialValues[n]
                        : getVar(n, c)
                    : newGetVar(n, c)));
            }
            const res = getVar(name, captureUndef ? false : captureUndef);
            if (res === undefined && captureUndef)
                return (values[name] = (0, streams_1.atom)(null));
            return res;
        };
        for (const name of Object.keys(assignItems))
            delete values[name];
        for (const name of Object.keys(assignItems))
            newGetVar(name);
        for (const { key } of mergeItems.filter((n) => !n.value)) {
            values[key] = (0, streams_1.atom)(null);
        }
        readVars(node, newGetVar);
        const content = partialContent.map((x) => x.compiled ? x.value : compileNode(x.value, newGetVar));
        const merges = mergeItems
            .filter((n) => n.value)
            .map(({ key, value }) => {
            {
                const target = newGetVar(key, false);
                if (!((0, util_1.isObject)(target) && target.isStream && target.set))
                    return null;
                const source = compileNode(value, newGetVar);
                return (0, streams_1.effect)(() => {
                    const res = (0, util_1.resolve)(source, true);
                    if (res !== undefined)
                        target.set(res);
                }, `merge ${key}`);
            }
        })
            .filter((x) => x);
        return { block: constructBlock(type, tag, values, content), merges };
    };
    if (items.some((n) => (0, util_1.isObject)(n) && ["merge", "unpack"].includes(n.type))) {
        const blockStream = (0, streams_1.derived)(result, "block parts");
        return (0, streams_1.derived)(() => {
            const { block, merges } = blockStream.get();
            for (const mergeStream of merges)
                mergeStream.get();
            return block;
        }, "block");
    }
    return result().block;
};
exports.default = compileNode;
//# sourceMappingURL=compile.js.map