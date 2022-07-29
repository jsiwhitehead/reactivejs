export declare const equalFn: <T>(a: T, b: T) => boolean;
export declare const $PROXY: unique symbol;
export declare const $TRACK: unique symbol;
export declare const $DEVCOMP: unique symbol;
export declare const NOTPENDING: {};
export declare var Owner: Owner | null;
export declare let Transition: TransitionState | null;
declare global {
    var _$afterUpdate: () => void;
}
export interface SignalState<T> {
    value?: T;
    observers: Computation<any>[] | null;
    observerSlots: number[] | null;
    pending: T | {};
    tValue?: T;
    comparator?: (prev: T, next: T) => boolean;
    name?: string;
}
export interface Owner {
    owned: Computation<any>[] | null;
    cleanups: (() => void)[] | null;
    owner: Owner | null;
    context: any | null;
    sourceMap?: Record<string, {
        value: unknown;
    }>;
    name?: string;
    componentName?: string;
}
export interface Computation<Init, Next extends Init = Init> extends Owner {
    fn: EffectFunction<Init, Next>;
    state: number;
    tState?: number;
    sources: SignalState<Next>[] | null;
    sourceSlots: number[] | null;
    value?: Init;
    updatedAt: number | null;
    pure: boolean;
    user?: boolean;
}
export interface TransitionState {
    sources: Set<SignalState<any>>;
    effects: Computation<any>[];
    promises: Set<Promise<any>>;
    disposed: Set<Computation<any>>;
    queue: Set<Computation<any>>;
    scheduler?: (fn: () => void) => unknown;
    running: boolean;
    done?: Promise<void>;
    resolve?: () => void;
}
export interface ExternalSource {
    track: EffectFunction<any, any>;
    dispose: () => void;
}
export declare type RootFunction<T> = (dispose: () => void) => T;
/**
 * Creates a new non-tracked reactive context that doesn't auto-dispose
 *
 * @param fn a function in which the reactive state is scoped
 * @param detachedOwner optional reactive context to bind the root to
 * @returns the output of `fn`.
 *
 * @description https://www.solidjs.com/docs/latest/api#createroot
 */
export declare function createRoot<T>(fn: RootFunction<T>, detachedOwner?: Owner): T;
export declare type Accessor<T> = () => T;
export declare type Setter<T> = (undefined extends T ? () => undefined : {}) & (<U extends T>(value: (prev: T) => U) => U) & (<U extends T>(value: Exclude<U, Function>) => U) & (<U extends T>(value: Exclude<U, Function> | ((prev: T) => U)) => U);
export declare type Signal<T> = [get: Accessor<T>, set: Setter<T>];
export interface SignalOptions<T> extends MemoOptions<T> {
    internal?: boolean;
}
/**
 * Creates a simple reactive state with a getter and setter
 * ```typescript
 * const [state: Accessor<T>, setState: Setter<T>] = createSignal<T>(
 *  value: T,
 *  options?: { name?: string, equals?: false | ((prev: T, next: T) => boolean) }
 * )
 * ```
 * @param value initial value of the state; if empty, the state's type will automatically extended with undefined; otherwise you need to extend the type manually if you want setting to undefined not be an error
 * @param options optional object with a name for debugging purposes and equals, a comparator function for the previous and next value to allow fine-grained control over the reactivity
 *
 * @returns ```typescript
 * [state: Accessor<T>, setState: Setter<T>]
 * ```
 * * the Accessor is merely a function that returns the current value and registers each call to the reactive root
 * * the Setter is a function that allows directly setting or mutating the value:
 * ```typescript
 * const [count, setCount] = createSignal(0);
 * setCount(count => count + 1);
 * ```
 *
 * @description https://www.solidjs.com/docs/latest/api#createsignal
 */
export declare function createSignal<T>(): Signal<T | undefined>;
export declare function createSignal<T>(value: T, options?: SignalOptions<T>): Signal<T>;
export interface BaseOptions {
    name?: string;
}
export declare type NoInfer<T extends any> = [T][T extends any ? 0 : never];
export interface EffectOptions extends BaseOptions {
}
export declare type EffectFunction<Prev, Next extends Prev = Prev> = (v: Prev) => Next;
/**
 * Creates a reactive computation that runs immediately before render, mainly used to write to other reactive primitives
 * ```typescript
 * export function createComputed<Next, Init = Next>(
 *   fn: (v: Init | Next) => Next,
 *   value?: Init,
 *   options?: { name?: string }
 * ): void;
 * ```
 * @param fn a function that receives its previous or the initial value, if set, and returns a new value used to react on a computation
 * @param value an optional initial value for the computation; if set, fn will never receive undefined as first argument
 * @param options allows to set a name in dev mode for debugging purposes
 *
 * @description https://www.solidjs.com/docs/latest/api#createcomputed
 */
export declare function createComputed<Next>(fn: EffectFunction<undefined | NoInfer<Next>, Next>): void;
export declare function createComputed<Next, Init = Next>(fn: EffectFunction<Init | Next, Next>, value: Init, options?: EffectOptions): void;
/**
 * Creates a reactive computation that runs during the render phase as DOM elements are created and updated but not necessarily connected
 * ```typescript
 * export function createRenderEffect<T>(
 *   fn: (v: T) => T,
 *   value?: T,
 *   options?: { name?: string }
 * ): void;
 * ```
 * @param fn a function that receives its previous or the initial value, if set, and returns a new value used to react on a computation
 * @param value an optional initial value for the computation; if set, fn will never receive undefined as first argument
 * @param options allows to set a name in dev mode for debugging purposes
 *
 * @description https://www.solidjs.com/docs/latest/api#createrendereffect
 */
export declare function createRenderEffect<Next>(fn: EffectFunction<undefined | NoInfer<Next>, Next>): void;
export declare function createRenderEffect<Next, Init = Next>(fn: EffectFunction<Init | Next, Next>, value: Init, options?: EffectOptions): void;
/**
 * Creates a reactive computation that runs after the render phase
 * ```typescript
 * export function createEffect<T>(
 *   fn: (v: T) => T,
 *   value?: T,
 *   options?: { name?: string }
 * ): void;
 * ```
 * @param fn a function that receives its previous or the initial value, if set, and returns a new value used to react on a computation
 * @param value an optional initial value for the computation; if set, fn will never receive undefined as first argument
 * @param options allows to set a name in dev mode for debugging purposes
 *
 * @description https://www.solidjs.com/docs/latest/api#createeffect
 */
export declare function createEffect<Next>(fn: EffectFunction<undefined | NoInfer<Next>, Next>): void;
export declare function createEffect<Next, Init = Next>(fn: EffectFunction<Init | Next, Next>, value: Init, options?: EffectOptions): void;
interface Memo<Prev, Next = Prev> extends SignalState<Next>, Computation<Next> {
    tOwned?: Computation<Prev | Next, Next>[];
}
export interface MemoOptions<T> extends EffectOptions {
    equals?: false | ((prev: T, next: T) => boolean);
}
/**
 * Creates a readonly derived reactive memoized signal
 * ```typescript
 * export function createMemo<T>(
 *   fn: (v: T) => T,
 *   value?: T,
 *   options?: { name?: string, equals?: false | ((prev: T, next: T) => boolean) }
 * ): () => T;
 * ```
 * @param fn a function that receives its previous or the initial value, if set, and returns a new value used to react on a computation
 * @param value an optional initial value for the computation; if set, fn will never receive undefined as first argument
 * @param options allows to set a name in dev mode for debugging purposes and use a custom comparison function in equals
 *
 * @description https://www.solidjs.com/docs/latest/api#creatememo
 */
export declare function createMemo<Next extends Prev, Prev = Next>(fn: EffectFunction<undefined | NoInfer<Prev>, Next>): Accessor<Next>;
export declare function createMemo<Next extends Prev, Init = Next, Prev = Next>(fn: EffectFunction<Init | Prev, Next>, value: Init, options?: MemoOptions<Next>): Accessor<Next>;
export interface Resource<T> extends Accessor<T> {
    loading: boolean;
    error: any;
    latest: T | undefined;
}
export declare type ResourceActions<T> = {
    mutate: Setter<T>;
    refetch: (info?: unknown) => T | Promise<T> | undefined | null;
};
export declare type ResourceReturn<T> = [Resource<T>, ResourceActions<T>];
export declare type ResourceSource<S> = S | false | null | undefined | (() => S | false | null | undefined);
export declare type ResourceFetcher<S, T> = (k: S, info: ResourceFetcherInfo<T>) => T | Promise<T>;
export declare type ResourceFetcherInfo<T> = {
    value: T | undefined;
    refetching?: unknown;
};
export declare type ResourceOptions<T> = undefined extends T ? {
    initialValue?: T;
    name?: string;
    deferStream?: boolean;
    onHydrated?: <S, T>(k: S, info: ResourceFetcherInfo<T>) => void;
} : {
    initialValue: T;
    name?: string;
    deferStream?: boolean;
    onHydrated?: <S, T>(k: S, info: ResourceFetcherInfo<T>) => void;
};
export declare type EqualityCheckerFunction<T, U> = (a: U, b: T) => boolean;
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
export declare function createSelector<T, U>(source: Accessor<T>, fn?: EqualityCheckerFunction<T, U>, options?: BaseOptions): (key: U) => boolean;
/**
 * Holds changes inside the block before the reactive context is updated
 * @param fn wraps the reactive updates that should be batched
 * @returns the return value from `fn`
 *
 * @description https://www.solidjs.com/docs/latest/api#batch
 */
export declare function batch<T>(fn: Accessor<T>): T;
/**
 * Ignores tracking context inside its scope
 * @param fn the scope that is out of the tracking context
 * @returns the return value of `fn`
 *
 * @description https://www.solidjs.com/docs/latest/api#untrack
 */
export declare function untrack<T>(fn: Accessor<T>): T;
/** @deprecated */
export declare type ReturnTypes<T> = T extends readonly Accessor<unknown>[] ? {
    [K in keyof T]: T[K] extends Accessor<infer I> ? I : never;
} : T extends Accessor<infer I> ? I : never;
export declare type AccessorArray<T> = [
    ...Extract<{
        [K in keyof T]: Accessor<T[K]>;
    }, readonly unknown[]>
];
export declare type OnEffectFunction<S, Prev, Next extends Prev = Prev> = (input: S, prevInput: S | undefined, prev: Prev) => Next;
export interface OnOptions {
    defer?: boolean;
}
/**
 * on - make dependencies of a computation explicit
 * ```typescript
 * export function on<S, U>(
 *   deps: Accessor<S> | AccessorArray<S>,
 *   fn: (input: S, prevInput: S | undefined, prevValue: U | undefined) => U,
 *   options?: { defer?: boolean } = {}
 * ): (prevValue: U | undefined) => U;
 * ```
 * @param deps list of reactive dependencies or a single reactive dependency
 * @param fn computation on input; the current previous content(s) of input and the previous value are given as arguments and it returns a new value
 * @param options optional, allows deferred computation until at the end of the next change
 * @returns an effect function that is passed into createEffect. For example:
 *
 * ```typescript
 * createEffect(on(a, (v) => console.log(v, b())));
 *
 * // is equivalent to:
 * createEffect(() => {
 *   const v = a();
 *   untrack(() => console.log(v, b()));
 * });
 * ```
 *
 * @description https://www.solidjs.com/docs/latest/api#on
 */
export declare function on<S, Next extends Prev, Prev = Next>(deps: AccessorArray<S> | Accessor<S>, fn: OnEffectFunction<S, undefined | NoInfer<Prev>, Next>, options?: OnOptions & {
    defer?: false;
}): EffectFunction<undefined | NoInfer<Next>, NoInfer<Next>>;
export declare function on<S, Next extends Prev, Prev = Next>(deps: AccessorArray<S> | Accessor<S>, fn: OnEffectFunction<S, undefined | NoInfer<Prev>, Next>, options: OnOptions & {
    defer: true;
}): EffectFunction<undefined | NoInfer<Next>>;
/**
 * onMount - run an effect only after initial render on mount
 * @param fn an effect that should run only once on mount
 *
 * @description https://www.solidjs.com/docs/latest/api#onmount
 */
export declare function onMount(fn: () => void): void;
/**
 * onCleanup - run an effect once before the reactive scope is disposed
 * @param fn an effect that should run only once on cleanup
 *
 * @description https://www.solidjs.com/docs/latest/api#oncleanup
 */
export declare function onCleanup(fn: () => void): () => void;
/**
 * onError - run an effect whenever an error is thrown within the context of the child scopes
 * @param fn an error handler that receives the error
 *
 * * If the error is thrown again inside the error handler, it will trigger the next available parent handler
 *
 * @description https://www.solidjs.com/docs/latest/api#onerror
 */
export declare function onError(fn: (err: any) => void): void;
export declare function getListener(): Computation<any, any> | null;
export declare function getOwner(): Owner | null;
export declare function runWithOwner<T>(o: Owner, fn: () => T): T;
/**
 * ```typescript
 * export function startTransition(fn: () => void) => Promise<void>
 *
 * @description https://www.solidjs.com/docs/latest/api#usetransition
 */
export declare function startTransition(fn: () => unknown): Promise<void>;
export declare type Transition = [Accessor<boolean>, (fn: () => void) => Promise<void>];
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
export declare function useTransition(): Transition;
export declare function resumeEffects(e: Computation<any>[]): void;
export declare function hashValue(v: any): string;
export declare function registerGraph(name: string, value: {
    value: unknown;
}): string;
interface GraphRecord {
    [k: string]: GraphRecord | unknown;
}
export declare function serializeGraph(owner?: Owner | null): GraphRecord;
export declare function readSignal(this: SignalState<any> | Memo<any>): any;
export declare function writeSignal(node: SignalState<any> | Memo<any>, value: any, isComp?: boolean): any;
export {};
