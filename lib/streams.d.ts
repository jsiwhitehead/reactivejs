declare class Queue {
    queue: any[] | null;
    add(streams: Set<any>): void;
    remove(stream: any): void;
    next(): void;
}
export declare class SourceStream {
    isStream: boolean;
    listeners: Set<any>;
    value: null;
    set: any;
    constructor(queue: Queue, initial: any);
    get(): null;
    addListener(x: any): void;
    removeListener(x: any): void;
}
export declare class Stream {
    isStream: boolean;
    listeners: Set<any>;
    index: any;
    value: null;
    start: any;
    update: any;
    stop: any;
    constructor(queue: Queue, index: any, run: any);
    addListener(x: any): void;
    removeListener(x: any): void;
}
declare const _default: (func: any) => () => any;
export default _default;
