export const equalFn = (a, b) => a === b;
export const $PROXY = Symbol("solid-proxy");
export const $TRACK = Symbol("solid-track");
export const $DEVCOMP = Symbol("solid-dev-component");
const signalOptions = { equals: equalFn };
let ERROR = null;
let runEffects = runQueue;
export const NOTPENDING = {};
const STALE = 1;
const PENDING = 2;
const UNOWNED = {
    owned: null,
    cleanups: null,
    context: null,
    owner: null,
};
const [transPending, setTransPending] = /*@__PURE__*/ createSignal(false);
export var Owner = null;
export let Transition = null;
let Scheduler = null;
let ExternalSourceFactory = null;
let Listener = null;
let Pending = null;
let Updates = null;
let Effects = null;
let ExecCount = 0;
let rootCount = 0;
/**
 * Creates a new non-tracked reactive context that doesn't auto-dispose
 *
 * @param fn a function in which the reactive state is scoped
 * @param detachedOwner optional reactive context to bind the root to
 * @returns the output of `fn`.
 *
 * @description https://www.solidjs.com/docs/latest/api#createroot
 */
export function createRoot(fn, detachedOwner) {
    const listener = Listener, owner = Owner, root = fn.length === 0 && !"_SOLID_DEV_"
        ? UNOWNED
        : {
            owned: null,
            cleanups: null,
            context: null,
            owner: detachedOwner || owner,
        };
    if ("_SOLID_DEV_" && owner)
        root.name = `${owner.name}-r${rootCount++}`;
    Owner = root;
    Listener = null;
    try {
        return runUpdates(() => fn(() => cleanNode(root)), true);
    }
    finally {
        Listener = listener;
        Owner = owner;
    }
}
export function createSignal(value, options) {
    options = options ? Object.assign({}, signalOptions, options) : signalOptions;
    const s = {
        value,
        observers: null,
        observerSlots: null,
        pending: NOTPENDING,
        comparator: options.equals || undefined,
    };
    if ("_SOLID_DEV_" && !options.internal)
        s.name = registerGraph(options.name || hashValue(value), s);
    const setter = (value) => {
        if (typeof value === "function") {
            if (Transition && Transition.running && Transition.sources.has(s))
                value = value(s.pending !== NOTPENDING ? s.pending : s.tValue);
            else
                value = value(s.pending !== NOTPENDING ? s.pending : s.value);
        }
        return writeSignal(s, value);
    };
    return [readSignal.bind(s), setter];
}
export function createComputed(fn, value, options) {
    const c = createComputation(fn, value, true, STALE, "_SOLID_DEV_" ? options : undefined);
    if (Scheduler && Transition && Transition.running)
        Updates.push(c);
    else
        updateComputation(c);
}
export function createRenderEffect(fn, value, options) {
    const c = createComputation(fn, value, false, STALE, "_SOLID_DEV_" ? options : undefined);
    if (Scheduler && Transition && Transition.running)
        Updates.push(c);
    else
        updateComputation(c);
}
export function createEffect(fn, value, options) {
    runEffects = runUserEffects;
    const c = createComputation(fn, value, false, STALE, "_SOLID_DEV_" ? options : undefined);
    c.user = true;
    Effects ? Effects.push(c) : updateComputation(c);
}
export function createMemo(fn, value, options) {
    options = options ? Object.assign({}, signalOptions, options) : signalOptions;
    const c = createComputation(fn, value, true, 0, "_SOLID_DEV_" ? options : undefined);
    c.pending = NOTPENDING;
    c.observers = null;
    c.observerSlots = null;
    c.comparator = options.equals || undefined;
    if (Scheduler && Transition && Transition.running) {
        c.tState = STALE;
        Updates.push(c);
    }
    else
        updateComputation(c);
    return readSignal.bind(c);
}
/**
 * Creates a conditional signal that only notifies subscribers when entering or exiting their key matching the value
 * ```typescript
 * export function createSelector<T, U>(
 *   source: () => T
 *   fn: (a: U, b: T) => boolean,
 *   options?: { name?: string }
 * ): (k: U) => boolean;
 * ```
 * @param source
 * @param fn a function that receives its previous or the initial value, if set, and returns a new value used to react on a computation
 * @param options allows to set a name in dev mode for debugging purposes, optional
 *
 * ```typescript
 * const isSelected = createSelector(selectedId);
 * <For each={list()}>
 *   {(item) => <li classList={{ active: isSelected(item.id) }}>{item.name}</li>}
 * </For>
 * ```
 *
 * This makes the operation O(2) instead of O(n).
 *
 * @description https://www.solidjs.com/docs/latest/api#createselector
 */
export function createSelector(source, fn = equalFn, options) {
    const subs = new Map();
    const node = createComputation((p) => {
        const v = source();
        for (const key of subs.keys())
            if (fn(key, v) !== fn(key, p)) {
                const l = subs.get(key);
                for (const c of l.values()) {
                    c.state = STALE;
                    if (c.pure)
                        Updates.push(c);
                    else
                        Effects.push(c);
                }
            }
        return v;
    }, undefined, true, STALE, "_SOLID_DEV_" ? options : undefined);
    updateComputation(node);
    return (key) => {
        let listener;
        if ((listener = Listener)) {
            let l;
            if ((l = subs.get(key)))
                l.add(listener);
            else
                subs.set(key, (l = new Set([listener])));
            onCleanup(() => {
                l.delete(listener);
                !l.size && subs.delete(key);
            });
        }
        return fn(key, Transition && Transition.running && Transition.sources.has(node)
            ? node.tValue
            : node.value);
    };
}
/**
 * Holds changes inside the block before the reactive context is updated
 * @param fn wraps the reactive updates that should be batched
 * @returns the return value from `fn`
 *
 * @description https://www.solidjs.com/docs/latest/api#batch
 */
export function batch(fn) {
    if (Pending)
        return fn();
    let result;
    const q = (Pending = []);
    try {
        result = fn();
    }
    finally {
        Pending = null;
    }
    runUpdates(() => {
        for (let i = 0; i < q.length; i += 1) {
            const data = q[i];
            if (data.pending !== NOTPENDING) {
                const pending = data.pending;
                data.pending = NOTPENDING;
                writeSignal(data, pending);
            }
        }
    }, false);
    return result;
}
/**
 * Ignores tracking context inside its scope
 * @param fn the scope that is out of the tracking context
 * @returns the return value of `fn`
 *
 * @description https://www.solidjs.com/docs/latest/api#untrack
 */
export function untrack(fn) {
    let result, listener = Listener;
    Listener = null;
    result = fn();
    Listener = listener;
    return result;
}
export function on(deps, fn, options) {
    const isArray = Array.isArray(deps);
    let prevInput;
    let defer = options && options.defer;
    return (prevValue) => {
        let input;
        if (isArray) {
            input = Array(deps.length);
            for (let i = 0; i < deps.length; i++)
                input[i] = deps[i]();
        }
        else
            input = deps();
        if (defer) {
            defer = false;
            return undefined;
        }
        const result = untrack(() => fn(input, prevInput, prevValue));
        prevInput = input;
        return result;
    };
}
/**
 * onMount - run an effect only after initial render on mount
 * @param fn an effect that should run only once on mount
 *
 * @description https://www.solidjs.com/docs/latest/api#onmount
 */
export function onMount(fn) {
    createEffect(() => untrack(fn));
}
/**
 * onCleanup - run an effect once before the reactive scope is disposed
 * @param fn an effect that should run only once on cleanup
 *
 * @description https://www.solidjs.com/docs/latest/api#oncleanup
 */
export function onCleanup(fn) {
    if (Owner === null)
        "_SOLID_DEV_" &&
            console.warn("cleanups created outside a `createRoot` or `render` will never be run");
    else if (Owner.cleanups === null)
        Owner.cleanups = [fn];
    else
        Owner.cleanups.push(fn);
    return fn;
}
/**
 * onError - run an effect whenever an error is thrown within the context of the child scopes
 * @param fn an error handler that receives the error
 *
 * * If the error is thrown again inside the error handler, it will trigger the next available parent handler
 *
 * @description https://www.solidjs.com/docs/latest/api#onerror
 */
export function onError(fn) {
    ERROR || (ERROR = Symbol("error"));
    if (Owner === null)
        "_SOLID_DEV_" &&
            console.warn("error handlers created outside a `createRoot` or `render` will never be run");
    else if (Owner.context === null)
        Owner.context = { [ERROR]: [fn] };
    else if (!Owner.context[ERROR])
        Owner.context[ERROR] = [fn];
    else
        Owner.context[ERROR].push(fn);
}
export function getListener() {
    return Listener;
}
export function getOwner() {
    return Owner;
}
export function runWithOwner(o, fn) {
    const prev = Owner;
    Owner = o;
    try {
        return runUpdates(fn, true);
    }
    finally {
        Owner = prev;
    }
}
/**
 * ```typescript
 * export function startTransition(fn: () => void) => Promise<void>
 *
 * @description https://www.solidjs.com/docs/latest/api#usetransition
 */
export function startTransition(fn) {
    if (Transition && Transition.running) {
        fn();
        return Transition.done;
    }
    const l = Listener;
    const o = Owner;
    return Promise.resolve().then(() => {
        Listener = l;
        Owner = o;
        let t;
        if (Scheduler) {
            t =
                Transition ||
                    (Transition = {
                        sources: new Set(),
                        effects: [],
                        promises: new Set(),
                        disposed: new Set(),
                        queue: new Set(),
                        running: true,
                    });
            t.done || (t.done = new Promise((res) => (t.resolve = res)));
            t.running = true;
        }
        batch(fn);
        Listener = Owner = null;
        return t ? t.done : undefined;
    });
}
/**
 * ```typescript
 * export function useTransition(): [
 *   () => boolean,
 *   (fn: () => void, cb?: () => void) => void
 * ];
 * @returns a tuple; first value is an accessor if the transition is pending and a callback to start the transition
 *
 * @description https://www.solidjs.com/docs/latest/api#usetransition
 */
export function useTransition() {
    return [transPending, startTransition];
}
export function resumeEffects(e) {
    Effects.push.apply(Effects, e);
    e.length = 0;
}
export function hashValue(v) {
    const s = new Set();
    return `s${typeof v === "string"
        ? hash(v)
        : hash(JSON.stringify(v, (k, v) => {
            if (typeof v === "object" && v != null) {
                if (s.has(v))
                    return;
                s.add(v);
                const keys = Object.keys(v);
                const desc = Object.getOwnPropertyDescriptors(v);
                const newDesc = keys.reduce((memo, key) => {
                    const value = desc[key];
                    // skip getters
                    if (!value.get)
                        memo[key] = value;
                    return memo;
                }, {});
                v = Object.create({}, newDesc);
            }
            if (typeof v === "bigint") {
                return `${v.toString()}n`;
            }
            return v;
        }) || "")}`;
}
export function registerGraph(name, value) {
    let tryName = name;
    if (Owner) {
        let i = 0;
        Owner.sourceMap || (Owner.sourceMap = {});
        while (Owner.sourceMap[tryName])
            tryName = `${name}-${++i}`;
        Owner.sourceMap[tryName] = value;
    }
    return tryName;
}
export function serializeGraph(owner) {
    owner || (owner = Owner);
    if (!"_SOLID_DEV_" || !owner)
        return {};
    return {
        ...serializeValues(owner.sourceMap),
        ...(owner.owned ? serializeChildren(owner) : {}),
    };
}
// Internal
export function readSignal() {
    const runningTransition = Transition && Transition.running;
    if (this.sources &&
        ((!runningTransition && this.state) ||
            (runningTransition && this.tState))) {
        const updates = Updates;
        Updates = null;
        (!runningTransition && this.state === STALE) ||
            (runningTransition && this.tState === STALE)
            ? updateComputation(this)
            : lookUpstream(this);
        Updates = updates;
    }
    if (Listener) {
        const sSlot = this.observers ? this.observers.length : 0;
        if (!Listener.sources) {
            Listener.sources = [this];
            Listener.sourceSlots = [sSlot];
        }
        else {
            Listener.sources.push(this);
            Listener.sourceSlots.push(sSlot);
        }
        if (!this.observers) {
            this.observers = [Listener];
            this.observerSlots = [Listener.sources.length - 1];
        }
        else {
            this.observers.push(Listener);
            this.observerSlots.push(Listener.sources.length - 1);
        }
    }
    if (runningTransition && Transition.sources.has(this))
        return this.tValue;
    return this.value;
}
export function writeSignal(node, value, isComp) {
    if (Pending) {
        if (node.pending === NOTPENDING)
            Pending.push(node);
        node.pending = value;
        return value;
    }
    if (node.comparator) {
        if (Transition && Transition.running && Transition.sources.has(node)) {
            if (node.comparator(node.tValue, value))
                return value;
        }
        else if (node.comparator(node.value, value))
            return value;
    }
    let TransitionRunning = false;
    if (Transition) {
        TransitionRunning = Transition.running;
        if (TransitionRunning || (!isComp && Transition.sources.has(node))) {
            Transition.sources.add(node);
            node.tValue = value;
        }
        if (!TransitionRunning)
            node.value = value;
    }
    else
        node.value = value;
    if (node.observers && node.observers.length) {
        runUpdates(() => {
            for (let i = 0; i < node.observers.length; i += 1) {
                const o = node.observers[i];
                if (TransitionRunning && Transition.disposed.has(o))
                    continue;
                if ((TransitionRunning && !o.tState) ||
                    (!TransitionRunning && !o.state)) {
                    if (o.pure)
                        Updates.push(o);
                    else
                        Effects.push(o);
                    if (o.observers)
                        markDownstream(o);
                }
                if (TransitionRunning)
                    o.tState = STALE;
                else
                    o.state = STALE;
            }
            if (Updates.length > 10e5) {
                Updates = [];
                if ("_SOLID_DEV_")
                    throw new Error("Potential Infinite Loop Detected.");
                throw new Error();
            }
        }, false);
    }
    return value;
}
function updateComputation(node) {
    if (!node.fn)
        return;
    cleanNode(node);
    const owner = Owner, listener = Listener, time = ExecCount;
    Listener = Owner = node;
    runComputation(node, Transition &&
        Transition.running &&
        Transition.sources.has(node)
        ? node.tValue
        : node.value, time);
    if (Transition &&
        !Transition.running &&
        Transition.sources.has(node)) {
        queueMicrotask(() => {
            runUpdates(() => {
                Transition && (Transition.running = true);
                runComputation(node, node.tValue, time);
            }, false);
        });
    }
    Listener = listener;
    Owner = owner;
}
function runComputation(node, value, time) {
    let nextValue;
    try {
        nextValue = node.fn(value);
    }
    catch (err) {
        handleError(err);
    }
    if (!node.updatedAt || node.updatedAt <= time) {
        if (node.observers &&
            node.observers.length) {
            writeSignal(node, nextValue, true);
        }
        else if (Transition && Transition.running && node.pure) {
            Transition.sources.add(node);
            node.tValue = nextValue;
        }
        else
            node.value = nextValue;
        node.updatedAt = time;
    }
}
function createComputation(fn, init, pure, state = STALE, options) {
    const c = {
        fn,
        state: state,
        updatedAt: null,
        owned: null,
        sources: null,
        sourceSlots: null,
        cleanups: null,
        value: init,
        owner: Owner,
        context: null,
        pure,
    };
    if (Transition && Transition.running) {
        c.state = 0;
        c.tState = state;
    }
    if (Owner === null)
        "_SOLID_DEV_" &&
            console.warn("computations created outside a `createRoot` or `render` will never be disposed");
    else if (Owner !== UNOWNED) {
        if (Transition && Transition.running && Owner.pure) {
            if (!Owner.tOwned)
                Owner.tOwned = [c];
            else
                Owner.tOwned.push(c);
        }
        else {
            if (!Owner.owned)
                Owner.owned = [c];
            else
                Owner.owned.push(c);
        }
        if ("_SOLID_DEV_")
            c.name =
                (options && options.name) ||
                    `${Owner.name || "c"}-${(Owner.owned || Owner.tOwned).length}`;
    }
    if (ExternalSourceFactory) {
        const [track, trigger] = createSignal(undefined, { equals: false });
        const ordinary = ExternalSourceFactory(c.fn, trigger);
        onCleanup(() => ordinary.dispose());
        const triggerInTransition = () => startTransition(trigger).then(() => inTransition.dispose());
        const inTransition = ExternalSourceFactory(c.fn, triggerInTransition);
        c.fn = (x) => {
            track();
            return Transition && Transition.running
                ? inTransition.track(x)
                : ordinary.track(x);
        };
    }
    return c;
}
function runTop(node) {
    const runningTransition = Transition && Transition.running;
    if ((!runningTransition && node.state === 0) ||
        (runningTransition && node.tState === 0))
        return;
    if ((!runningTransition && node.state === PENDING) ||
        (runningTransition && node.tState === PENDING))
        return lookUpstream(node);
    const ancestors = [node];
    while ((node = node.owner) &&
        (!node.updatedAt || node.updatedAt < ExecCount)) {
        if (runningTransition && Transition.disposed.has(node))
            return;
        if ((!runningTransition && node.state) ||
            (runningTransition && node.tState))
            ancestors.push(node);
    }
    for (let i = ancestors.length - 1; i >= 0; i--) {
        node = ancestors[i];
        if (runningTransition) {
            let top = node, prev = ancestors[i + 1];
            while ((top = top.owner) && top !== prev) {
                if (Transition.disposed.has(top))
                    return;
            }
        }
        if ((!runningTransition && node.state === STALE) ||
            (runningTransition && node.tState === STALE)) {
            updateComputation(node);
        }
        else if ((!runningTransition && node.state === PENDING) ||
            (runningTransition && node.tState === PENDING)) {
            const updates = Updates;
            Updates = null;
            lookUpstream(node, ancestors[0]);
            Updates = updates;
        }
    }
}
function runUpdates(fn, init) {
    if (Updates)
        return fn();
    let wait = false;
    if (!init)
        Updates = [];
    if (Effects)
        wait = true;
    else
        Effects = [];
    ExecCount++;
    try {
        const res = fn();
        completeUpdates(wait);
        return res;
    }
    catch (err) {
        handleError(err);
    }
    finally {
        Updates = null;
        if (!wait)
            Effects = null;
    }
}
function completeUpdates(wait) {
    if (Updates) {
        if (Scheduler && Transition && Transition.running)
            scheduleQueue(Updates);
        else
            runQueue(Updates);
        Updates = null;
    }
    if (wait)
        return;
    let res;
    if (Transition && Transition.running) {
        if (Transition.promises.size || Transition.queue.size) {
            Transition.running = false;
            Transition.effects.push.apply(Transition.effects, Effects);
            Effects = null;
            setTransPending(true);
            return;
        }
        // finish transition
        const sources = Transition.sources;
        res = Transition.resolve;
        Effects.forEach((e) => {
            "tState" in e && (e.state = e.tState);
            delete e.tState;
        });
        Transition = null;
        batch(() => {
            sources.forEach((v) => {
                v.value = v.tValue;
                if (v.owned) {
                    for (let i = 0, len = v.owned.length; i < len; i++)
                        cleanNode(v.owned[i]);
                }
                if (v.tOwned)
                    v.owned = v.tOwned;
                delete v.tValue;
                delete v.tOwned;
                v.tState = 0;
            });
            setTransPending(false);
        });
    }
    if (Effects.length)
        batch(() => {
            runEffects(Effects);
            Effects = null;
        });
    else {
        Effects = null;
        if ("_SOLID_DEV_")
            globalThis._$afterUpdate && globalThis._$afterUpdate();
    }
    if (res)
        res();
}
function runQueue(queue) {
    for (let i = 0; i < queue.length; i++)
        runTop(queue[i]);
}
function scheduleQueue(queue) {
    for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        const tasks = Transition.queue;
        if (!tasks.has(item)) {
            tasks.add(item);
            Scheduler(() => {
                tasks.delete(item);
                runUpdates(() => {
                    Transition.running = true;
                    runTop(item);
                    if (!tasks.size) {
                        Effects.push.apply(Effects, Transition.effects);
                        Transition.effects = [];
                    }
                }, false);
                Transition && (Transition.running = false);
            });
        }
    }
}
function runUserEffects(queue) {
    let i, userLength = 0;
    for (i = 0; i < queue.length; i++) {
        const e = queue[i];
        if (!e.user)
            runTop(e);
        else
            queue[userLength++] = e;
    }
    const resume = queue.length;
    for (i = 0; i < userLength; i++)
        runTop(queue[i]);
    for (i = resume; i < queue.length; i++)
        runTop(queue[i]);
}
function lookUpstream(node, ignore) {
    const runningTransition = Transition && Transition.running;
    if (runningTransition)
        node.tState = 0;
    else
        node.state = 0;
    for (let i = 0; i < node.sources.length; i += 1) {
        const source = node.sources[i];
        if (source.sources) {
            if ((!runningTransition && source.state === STALE) ||
                (runningTransition && source.tState === STALE)) {
                if (source !== ignore)
                    runTop(source);
            }
            else if ((!runningTransition && source.state === PENDING) ||
                (runningTransition && source.tState === PENDING))
                lookUpstream(source, ignore);
        }
    }
}
function markDownstream(node) {
    const runningTransition = Transition && Transition.running;
    for (let i = 0; i < node.observers.length; i += 1) {
        const o = node.observers[i];
        if ((!runningTransition && !o.state) || (runningTransition && !o.tState)) {
            if (runningTransition)
                o.tState = PENDING;
            else
                o.state = PENDING;
            if (o.pure)
                Updates.push(o);
            else
                Effects.push(o);
            o.observers && markDownstream(o);
        }
    }
}
function cleanNode(node) {
    let i;
    if (node.sources) {
        while (node.sources.length) {
            const source = node.sources.pop(), index = node.sourceSlots.pop(), obs = source.observers;
            if (obs && obs.length) {
                const n = obs.pop(), s = source.observerSlots.pop();
                if (index < obs.length) {
                    n.sourceSlots[s] = index;
                    obs[index] = n;
                    source.observerSlots[index] = s;
                }
            }
        }
    }
    if (Transition && Transition.running && node.pure) {
        if (node.tOwned) {
            for (i = 0; i < node.tOwned.length; i++)
                cleanNode(node.tOwned[i]);
            delete node.tOwned;
        }
        reset(node, true);
    }
    else if (node.owned) {
        for (i = 0; i < node.owned.length; i++)
            cleanNode(node.owned[i]);
        node.owned = null;
    }
    if (node.cleanups) {
        for (i = 0; i < node.cleanups.length; i++)
            node.cleanups[i]();
        node.cleanups = null;
    }
    if (Transition && Transition.running)
        node.tState = 0;
    else
        node.state = 0;
    node.context = null;
}
function reset(node, top) {
    if (!top) {
        node.tState = 0;
        Transition.disposed.add(node);
    }
    if (node.owned) {
        for (let i = 0; i < node.owned.length; i++)
            reset(node.owned[i]);
    }
}
function handleError(err) {
    const fns = ERROR && lookup(Owner, ERROR);
    if (!fns)
        throw err;
    fns.forEach((f) => f(err));
}
function lookup(owner, key) {
    return owner
        ? owner.context && owner.context[key] !== undefined
            ? owner.context[key]
            : lookup(owner.owner, key)
        : undefined;
}
function hash(s) {
    for (var i = 0, h = 9; i < s.length;)
        h = Math.imul(h ^ s.charCodeAt(i++), 9 ** 9);
    return `${h ^ (h >>> 9)}`;
}
function serializeValues(sources = {}) {
    const k = Object.keys(sources);
    const result = {};
    for (let i = 0; i < k.length; i++) {
        const key = k[i];
        result[key] = sources[key].value;
    }
    return result;
}
function serializeChildren(root) {
    const result = {};
    for (let i = 0, len = root.owned.length; i < len; i++) {
        const node = root.owned[i];
        result[node.componentName ? `${node.componentName}:${node.name}` : node.name] = {
            ...serializeValues(node.sourceMap),
            ...(node.owned ? serializeChildren(node) : {}),
        };
    }
    return result;
}
//# sourceMappingURL=signal.js.map