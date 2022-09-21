export declare class SourceStream {
    isStream: boolean;
    listeners: Set<any>;
    value: any;
    set: any;
    constructor(initial: any);
    update(map: any): void;
    addListener(x: any): void;
    removeListener(x: any): void;
    get(): any;
}
export declare class Stream {
    isStream: boolean;
    listeners: Set<any>;
    index: any;
    value: null;
    start: any;
    update: any;
    stop: any;
    constructor(run: any);
    addListener(x: any): void;
    removeListener(x: any): void;
    get(): any;
}
export declare const atom: (initial?: any) => SourceStream;
export declare const stream: (run: any) => any;
export declare const derived: (map: any) => any;
export declare const effect: (map: any) => any;
declare const _default: (func: any) => void;
export default _default;