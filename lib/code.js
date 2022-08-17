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
const acorn = __importStar(require("acorn"));
const astring = __importStar(require("astring"));
const util_1 = require("./util");
const buildCallNode = (func, ...args) => ({
    type: "CallExpression",
    callee: { type: "Identifier", name: func },
    arguments: args,
});
const updateNode = (node, parent, prop) => {
    if (node.type === "Identifier" &&
        !["undefined", "null"].includes(node.name)) {
        const value = { type: "Literal", value: node.name };
        if (prop === "property" && !parent.computed)
            return value;
        return buildCallNode("getValue", value);
    }
    if (node.type === "MemberExpression") {
        return buildCallNode("doMember", node.object, node.property);
    }
    if (node.type === "CallExpression") {
        return buildCallNode("doCall", node.callee, node.arguments[0]);
    }
    return node;
};
const dontResolve = {
    Program: ["body"],
    ExpressionStatement: ["expression"],
    ConditionalExpression: ["consequent", "alternate"],
    LogicalExpression: ["right"],
    CallExpression: ["arguments"],
};
exports.default = (code) => {
    let hasResolve = false;
    const walkNode = (node, resolve, parent, prop) => {
        if (!(0, util_1.isObject)(node) || typeof node.type !== "string")
            return node;
        const walked = (0, util_1.mapObject)(node, (v, k) => {
            const res = resolve || !dontResolve[node.type]?.includes(k);
            if (Array.isArray(v))
                return v.map((x) => walkNode(x, res, node, k));
            return walkNode(v, res, node, k);
        });
        const updated = updateNode(walked, parent, prop);
        if (resolve && updated !== walked) {
            hasResolve = true;
            return buildCallNode("resolve", updated);
        }
        return updated;
    };
    const tree = walkNode(acorn.parse(code, { ecmaVersion: 2022 }));
    for (const e of tree.body.slice(0, -1)) {
        hasResolve = true;
        e.expression = buildCallNode("resolveDeep", e.expression);
    }
    const newCode = astring.generate(tree).split(";\n");
    newCode[newCode.length - 2] = "return " + newCode[newCode.length - 2];
    return { code: newCode.join(";\n"), multi: newCode.length > 2, hasResolve };
};
//# sourceMappingURL=code.js.map