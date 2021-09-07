/**
 * Creates a proxy object of the given class declaration.
 *
 * @param object
 * @param {(method: string, ...args: any[]) => any} callback
 * @returns {{}}
 */
export declare function createDelegateProxy(object: any, callback: (method: string, ...args: any[]) => any): any;
export declare type DelegateProxy = {
    [name: string]: (...args: any[]) => Promise<any>;
};
