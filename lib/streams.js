"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.derived = exports.stream = exports.atom = exports.Stream = exports.SourceStream = void 0;
let context = null;
const withContext = (index, observe, func) => {
    const current = context;
    context = { index, observe };
    const result = func();
    context = current;
    return result;
};
const compare = (a, b) => {
    const l = Math.max(a.length, b.length);
    for (let i = 0; i < l; i++) {
        if (a[i] === undefined)
            return 1;
        if (b[i] === undefined)
            return -1;
        if (a[i] !== b[i])
            return a[i] - b[i];
    }
    return 0;
};
const insertSorted = (array, value) => {
    let low = 0;
    let high = array.length;
    while (low < high) {
        const mid = (low + high) >>> 1;
        if (compare(array[mid].index, value.index) < 0)
            low = mid + 1;
        else
            high = mid;
    }
    if (array[low] !== value)
        array.splice(low, 0, value);
};
class Queue {
    queue = null;
    trace = new Set();
    add(streams, source = null) {
        const first = !this.queue;
        if (first)
            this.queue = [];
        for (const s of streams) {
            if (s.index)
                insertSorted(this.queue, s);
        }
        if (source)
            this.trace.add(source);
        if (first)
            this.next();
    }
    remove(stream) {
        if (this.queue) {
            const i = this.queue.indexOf(stream);
            if (i !== -1)
                this.queue.splice(i, 1);
        }
    }
    next() {
        if (this.queue && this.queue.length > 0) {
            const next = this.queue.shift();
            next.update();
            this.next();
        }
        else {
            this.queue = null;
            this.trace = new Set();
        }
    }
}
const queue = new Queue();
class SourceStream {
    isStream = true;
    listeners = new Set();
    value = null;
    set;
    constructor(initial) {
        this.value = initial;
        this.set = (value) => {
            if (!queue.trace.has(this)) {
                this.value = value;
                queue.add(this.listeners, this);
            }
        };
    }
    update(map) {
        this.set(map(this.value));
    }
    addListener(x) {
        this.listeners.add(x);
    }
    removeListener(x) {
        if (this.listeners.has(x))
            this.listeners.delete(x);
    }
    get() {
        return context.observe(this);
    }
}
exports.SourceStream = SourceStream;
class Stream {
    isStream = true;
    listeners = new Set();
    index;
    value = null;
    start;
    update;
    stop;
    constructor(run) {
        this.index = context.index;
        this.start = () => {
            let firstUpdate = true;
            const disposers = [];
            const set = (value) => {
                this.value = value;
                if (!firstUpdate)
                    queue.add(this.listeners);
            };
            const update = run(set, (d) => disposers.push(d));
            let active = new Set();
            const observe = (s) => {
                s.addListener(this);
                active.add(s);
                return s.value;
            };
            this.update = () => {
                const prevActive = active;
                active = new Set();
                if (typeof update === "function") {
                    withContext([...this.index, 0], observe, update);
                }
                for (const s of prevActive) {
                    if (!active.has(s))
                        s.removeListener(this);
                }
            };
            this.stop = () => {
                queue.remove(this);
                for (const s of active.values())
                    s.removeListener(this);
                active = new Set();
                disposers.forEach((d) => d());
            };
            if (typeof update === "function") {
                withContext([...this.index, 0], observe, update);
            }
            firstUpdate = false;
        };
    }
    addListener(x) {
        if (this.listeners.size === 0)
            this.start();
        this.listeners.add(x);
    }
    removeListener(x) {
        if (this.listeners.has(x)) {
            this.listeners.delete(x);
            if (this.listeners.size === 0)
                this.stop();
        }
    }
    get() {
        return context.observe(this);
    }
}
exports.Stream = Stream;
const atom = (initial) => new SourceStream(initial);
exports.atom = atom;
const stream = (run) => {
    context.index = [
        ...context.index.slice(0, -1),
        context.index[context.index.length - 1] + 1,
    ];
    return new Stream(run);
};
exports.stream = stream;
const derived = (map) => (0, exports.stream)((set) => () => set(map()));
exports.derived = derived;
let count = 0;
exports.default = (func) => withContext([count++, 0], null, () => {
    const stream = (0, exports.derived)(func());
    stream.start();
    return () => stream.stop();
});
//# sourceMappingURL=streams.js.map