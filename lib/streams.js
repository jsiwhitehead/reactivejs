"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolve = exports.isSourceStream = exports.isStream = exports.effect = exports.derived = exports.atom = void 0;
const DEBUG = false;
let debugIndex = 0;
let current;
const withCurrent = (s, func) => {
    const prev = current;
    current = s;
    const result = func();
    current = prev;
    return result;
};
const sourceUpdated = new Set();
const effectTraced = new Set();
const queue = new Set();
const runNext = () => {
    if (queue.size > 0) {
        const queueArray = [...queue];
        if (DEBUG) {
            console.log(`Queue: ${queueArray
                .map((q) => `${q.index}: ${q.debug} = ${q.traceCount}`)
                .join(", ")}`);
        }
        const maxCount = Math.max(...queueArray.map((q) => q.traceCount));
        const next = queueArray.find((q) => q.traceCount === maxCount);
        queue.delete(next);
        next.update();
        runNext();
    }
    else {
        sourceUpdated.clear();
        for (const s of effectTraced)
            s.traceCount = 0;
        effectTraced.clear();
    }
};
class SourceStream {
    isStream = true;
    value;
    observedBy = new Set();
    constructor(value) {
        this.value = value;
    }
    set(value) {
        if (!sourceUpdated.has(this)) {
            const first = sourceUpdated.size === 0;
            sourceUpdated.add(this);
            this.value = value;
            for (const s of this.observedBy)
                s.stale();
            if (first)
                runNext();
        }
    }
    update(map) {
        this.set(map(this.value));
    }
    get() {
        this.observedBy.add(current);
        current.observing.add(this);
        return this.value;
    }
    stopGet(s) {
        this.observedBy.delete(s);
    }
}
class Stream {
    isStream = true;
    index = DEBUG && debugIndex++;
    run;
    isEffect;
    debug;
    state = "stale";
    traceCount = 0;
    value;
    observedBy = new Set();
    observing = new Set();
    constructor(run, isEffect, debug) {
        this.run = run;
        this.isEffect = isEffect;
        this.debug = debug;
    }
    stale() {
        if (DEBUG)
            console.log(`Stale:\t${this.index}: ${this.debug}`);
        this.state = "stale";
        if (this.isEffect) {
            queue.add(this);
            for (const s of this.observedBy)
                s.trace();
        }
        else {
            for (const s of this.observedBy)
                s.stale();
        }
    }
    trace() {
        if (this.isEffect) {
            if (DEBUG)
                console.log(`Trace:\t${this.index}: ${this.debug}`);
            this.traceCount++;
            effectTraced.add(this);
        }
        for (const s of this.observedBy)
            s.trace();
    }
    update() {
        if (DEBUG)
            console.log(`Update:\t${this.index}: ${this.debug}`);
        this.state = "stable";
        const prevObserving = this.observing;
        this.observing = new Set();
        this.value = withCurrent(this, this.run);
        for (const s of prevObserving) {
            if (!this.observing.has(s))
                s.stopGet(this);
        }
    }
    get() {
        if (DEBUG)
            console.log(`Get:\t${this.index}: ${this.debug}`);
        if (this.state === "stale")
            this.update();
        if (this.observing.size > 0) {
            current.observing.add(this);
            this.observedBy.add(current);
        }
        if (DEBUG) {
            console.log(`Read:\t${this.index}: ${this.debug}, ${JSON.stringify(this.value, (_, x) => (x?.isStream ? "stream: " + x.index : x))}`);
        }
        return this.value;
    }
    stopGet(s) {
        this.observedBy.delete(s);
        if (this.observedBy.size === 0) {
            if (DEBUG)
                console.log(`Stop:\t${this.index}: ${this.debug}`);
            this.state = "stale";
            this.traceCount = 0;
            queue.delete(this);
            for (const s of this.observing)
                s.stopGet(this);
            this.observing = new Set();
        }
    }
}
const atom = (initial) => new SourceStream(initial);
exports.atom = atom;
const derived = (run, debug = "") => new Stream(run, false, debug);
exports.derived = derived;
const effect = (run, debug = "") => new Stream(run, true, debug).get();
exports.effect = effect;
const isStream = (x) => x && typeof x === "object" && x.isStream;
exports.isStream = isStream;
const isSourceStream = (x) => (0, exports.isStream)(x) && x.set;
exports.isSourceStream = isSourceStream;
const resolve = (x, deep = false) => {
    if (!x)
        return x;
    if (Array.isArray(x)) {
        if (!deep)
            return x;
        return x.map((y) => (0, exports.resolve)(y, true));
    }
    if (typeof x === "object") {
        if (x.isStream)
            return (0, exports.resolve)(x.get(), deep);
        if (!deep)
            return x;
        return Object.fromEntries(Object.entries(x).map(([k, y]) => [k, (0, exports.resolve)(y, true)]));
    }
    return x;
};
exports.resolve = resolve;
exports.default = (run, once = false) => {
    const s = new Stream(run, true, "run");
    queue.add(s);
    runNext();
    if (!once)
        return () => s.stopGet();
    s.stopGet();
    return s.value;
};
//# sourceMappingURL=streams.js.map