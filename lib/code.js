"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reactiveFunc = void 0;
const acorn = __importStar(require("acorn"));
const astring = __importStar(require("astring"));
const streams_1 = require("./streams");
const util_1 = require("./util");
const reactiveFunc = (func) => Object.assign(func, { reactiveFunc: true });
exports.reactiveFunc = reactiveFunc;
const buildCall = (func, ...args) => ({
    type: "CallExpression",
    callee: { type: "Identifier", name: func },
    arguments: args,
});
const dontResolve = {
    Program: ["body"],
    ExpressionStatement: ["expression"],
    ConditionalExpression: ["consequent", "alternate"],
    LogicalExpression: ["right"],
    CallExpression: ["arguments"],
};
const doMember = (obj, optional, prop) => {
    if (!obj && optional)
        return undefined;
    const res = obj[prop];
    if (typeof res !== "function")
        return res;
    if (Array.isArray(obj)) {
        if (["join", "includes", "indexOf", "lastIndexOf"].includes(prop)) {
            return res.bind((0, util_1.resolve)(obj, true));
        }
        if ([
            "copyWithin",
            "fill",
            "pop",
            "push",
            "reverse",
            "shift",
            "sort",
            "splice",
            "unshift",
        ].includes(prop)) {
            return res.bind([...obj]);
        }
    }
    return res.bind(obj);
};
const doCall = (func, optional, ...args) => {
    if (!func && optional)
        return undefined;
    if (func.reactiveFunc) {
        return func(...args);
    }
    if (["bound map", "bound reduce"].includes(func.name)) {
        return func(...args.map((a, i) => (i === 0 ? (0, util_1.resolve)(a) : a)));
    }
    if (["bound flatMap", "bound sort"].includes(func.name)) {
        return func(...args.map((a) => {
            const v = (0, util_1.resolve)(a);
            return typeof v === "function" ? (...x) => (0, util_1.resolve)(v(...x)) : v;
        }));
    }
    return func(...args.map((a) => {
        const v = (0, util_1.resolve)(a, true);
        return typeof v === "function" ? (...x) => (0, util_1.resolve)(v(...x), true) : v;
    }));
};
exports.default = (code) => {
    const vars = {};
    const updateNode = (node, parent, prop) => {
        if (node.type === "Identifier" &&
            !["undefined", "null"].includes(node.name) &&
            prop !== "key") {
            const value = { type: "Literal", value: node.name };
            if (prop === "property" && !parent.computed)
                return value;
            vars[node.name] = true;
            return buildCall("getValue", value);
        }
        if (node.type === "MemberExpression") {
            return buildCall("doMember", node.object, { type: "Identifier", name: node.optional ? "true" : "false" }, node.property);
        }
        if (node.type === "CallExpression") {
            return buildCall("doCall", node.callee, { type: "Identifier", name: node.optional ? "true" : "false" }, ...node.arguments);
        }
        return node;
    };
    const walkNode = (node, doResolve, parent, prop) => {
        if (typeof node !== "object" || typeof node.type !== "string")
            return node;
        const walked = Object.fromEntries(Object.entries(node).map(([k, v]) => {
            const res = doResolve || !dontResolve[node.type]?.includes(k);
            if (Array.isArray(v)) {
                return [k, v.map((x) => walkNode(x, res, node, k))];
            }
            return [k, walkNode(v, res, node, k)];
        }));
        const updated = updateNode(walked, parent, prop);
        if (doResolve && updated !== walked)
            return buildCall("resolve", updated);
        return updated;
    };
    const ast = walkNode(acorn.parse(code, { ecmaVersion: 2022 }));
    const newCode = astring.generate(ast);
    const func = Function(`"use strict";
    return (getValue, doMember, doCall, resolve) => {
      return ${newCode}
    };`)();
    return {
        vars: Object.keys(vars),
        run: (getValue) => (0, streams_1.derived)(() => func(getValue, doMember, doCall, util_1.resolve), code),
    };
};
//# sourceMappingURL=code.js.map