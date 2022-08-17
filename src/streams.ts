import { isObject, mapObject } from "./util";

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
    if (first) setTimeout(() => this.next());
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
  value = null;
  set;

  constructor(queue: Queue, initial) {
    this.value = initial;
    this.set = (value) => {
      this.value = value;
      queue.add(this.listeners);
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
  index;
  value = null;
  start;
  update;
  stop;

  constructor(queue: Queue, index, run) {
    const obj = {};
    this.index = index;
    this.start = () => {
      let firstUpdate = true;
      const disposers = [] as any[];
      const set = (value) => {
        this.value = value;
        if (!firstUpdate) queue.add(this.listeners);
      };
      const update = run(set, (d) => disposers.push(d));

      let active = new Set<any>();
      const observe = (s, sample) => {
        s.addListener(sample ? obj : this);
        active.add(s);
        return s.value;
      };
      const get = (data, deep = false, sample = false) => {
        if (typeof data === "object" && data.isStream) {
          return get(observe(data, sample), deep);
        }
        if (!deep) return data;
        if (Array.isArray(data)) return data.map((x) => get(x, true));
        if (isObject(data)) return mapObject(data, (x) => get(x, true));
        return data;
      };
      let counter = 0;
      const create = (run) => new Stream(queue, [...index, counter++], run);
      if (typeof update === "function") update(get, create);
      firstUpdate = false;

      this.update = () => {
        const prevActive = active;
        active = new Set();
        counter = 0;
        if (typeof update === "function") update(get, create);
        for (const s of prevActive) {
          if (!active.has(s)) {
            s.removeListener(this);
            s.removeListener(obj);
          }
        }
      };
      this.stop = () => {
        queue.remove(this);
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

export default (func) => {
  const queue = new Queue();
  const createData = (initial) => new SourceStream(queue, initial);
  let counter = 0;
  const create = (run) => new Stream(queue, [counter++], run);
  const update = func(createData, create);
  const stream = create(() => update);
  stream.start();
  return () => stream.stop();
};
