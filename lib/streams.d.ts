declare class SourceStream {
    isStream: boolean;
    value: any;
    observedBy: Set<any>;
    constructor(value: any);
    set(value: any): void;
    update(map: any): void;
    get(): any;
    stopGet(s: any): void;
}
declare class Stream {
    isStream: boolean;
    index: boolean;
    run: any;
    isEffect: any;
    debug: any;
    state: string;
    traceCount: number;
    value: any;
    observedBy: Set<any>;
    observing: Set<any>;
    constructor(run: any, isEffect: any, debug: any);
    stale(): void;
    trace(): void;
    update(): void;
    get(): any;
    stopGet(s?: any): void;
}
export declare const atom: (initial?: any) => SourceStream;
export declare const derived: (run: any, debug?: string) => Stream;
export declare const effect: (run: any, debug?: string) => any;
export declare const isStream: (x: any) => any;
export declare const isSourceStream: (x: any) => any;
export declare const resolve: (x: any, deep?: boolean) => any;
declare const _default: (run: any, once?: boolean) => any;
export default _default;
