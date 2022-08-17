import { isObject, mapObject } from "./util";

let context = null as any;
const withContext = (queue, index, observe, func) => {
  const current = context;
  context = { queue, index, observe };
  const result = func();
  context = current;
  return result;
};

const compare = (a, b) => {
  const l = Math.max(a.length, b.length);
  for (let i = 0; i < l; i++) {
    if (a[i] === undefined) return 1;
    if (b[i] === undefined) return -1;
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
};
const insertSorted = (array, value) => {
  let low = 0;
  let high = array.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (compare(array[mid].index, value.index) < 0) low = mid + 1;
    else high = mid;
  }
  if (array[low] !== value) array.splice(low, 0, value);
};

class Queue {
  queue: any[] | null = null;
  add(streams: Set<any>) {
    const first = !this.queue;
    if (first) this.queue = [];
    for (const s of streams) {
      if (s.index) insertSorted(this.queue, s);
    }
    if (first) this.next();
  }
  remove(stream) {
    if (this.queue) {
      const i = this.queue.indexOf(stream);
      if (i !== -1) this.queue.splice(i, 1);
    }
  }
  next() {
    if (this.queue && this.queue.length > 0) {
      const next = this.queue.shift();
      next.update();
      this.next();
    } else {
      this.queue = null;
    }
  }
}

export class SourceStream {
  isStream = true;

  listeners = new Set<any>();
  queue;
  value = null;
  set;

  constructor(initial) {
    this.queue = context.queue;
    this.value = initial;
    this.set = (value) => {
      this.value = value;
      this.queue.add(this.listeners);
    };
  }

  get() {
    return this.value;
  }

  addListener(x) {
    this.listeners.add(x);
  }
  removeListener(x) {
    if (this.listeners.has(x)) this.listeners.delete(x);
  }
}

export class Stream {
  isStream = true;

  listeners = new Set<any>();
  queue;
  index;
  value = null;
  start;
  update;
  stop;

  constructor(run) {
    const obj = {};
    this.queue = context.queue;
    this.index = context.index;
    this.start = () => {
      let firstUpdate = true;
      const disposers = [] as any[];
      const set = (value) => {
        this.value = value;
        if (!firstUpdate) this.queue.add(this.listeners);
      };
      const update = run(set, (d) => disposers.push(d));

      let active = new Set<any>();
      const observe = (s, sample) => {
        s.addListener(sample ? obj : this);
        active.add(s);
        return s.value;
      };
      if (typeof update === "function") {
        withContext(this.queue, [...this.index, 0], observe, update);
      }
      firstUpdate = false;

      this.update = () => {
        const prevActive = active;
        active = new Set();
        if (typeof update === "function") {
          withContext(this.queue, [...this.index, 0], observe, update);
        }
        for (const s of prevActive) {
          if (!active.has(s)) {
            s.removeListener(this);
            s.removeListener(obj);
          }
        }
      };
      this.stop = () => {
        this.queue.remove(this);
        for (const s of active.values()) {
          s.removeListener(this);
          s.removeListener(obj);
        }
        active = new Set();
        disposers.forEach((d) => d());
      };
    };
  }

  addListener(x) {
    if (this.listeners.size === 0) this.start();
    this.listeners.add(x);
  }
  removeListener(x) {
    if (this.listeners.has(x)) {
      this.listeners.delete(x);
      if (this.listeners.size === 0) this.stop();
    }
  }
}

export const atom = (initial?) => new SourceStream(initial) as any;

export const reactive = (run) => {
  context.index = [
    ...context.index.slice(0, -1),
    context.index[context.index.length - 1] + 1,
  ];
  return new Stream(run) as any;
};

export const derived = (map) => reactive((set) => () => set(map()));

export const get = (x, deep = false, sample = false) => {
  if (typeof x === "object" && x.isStream) {
    return get(context.observe(x, sample), deep);
  }
  if (!deep) return x;
  if (Array.isArray(x)) return x.map((y) => get(y, true));
  if (isObject(x)) return mapObject(x, (y) => get(y, true));
  return x;
};

export default (func) =>
  withContext(new Queue(), [0], null, () => {
    const update = func();
    const stream = reactive(() => update);
    stream.start();
    return () => stream.stop();
  });
