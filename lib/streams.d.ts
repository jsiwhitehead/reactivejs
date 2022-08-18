export declare class SourceStream {
    isStream: boolean;
    listeners: Set<any>;
    queue: any;
    value: null;
    set: any;
    constructor(initial: any);
    get(): null;
    addListener(x: any): void;
    removeListener(x: any): void;
    observe(): any;
}
export declare class Stream {
    isStream: boolean;
    listeners: Set<any>;
    queue: any;
    index: any;
    value: null;
    start: any;
    update: any;
    stop: any;
    constructor(run: any);
    addListener(x: any): void;
    removeListener(x: any): void;
    observe(sample?: boolean): any;
}
export declare const atom: (initial?: any) => any;
export declare const stream: (run: any) => any;
export declare const derived: (map: any) => any;
declare const _default: (func: any) => any;
export default _default;
