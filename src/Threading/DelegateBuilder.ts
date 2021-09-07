/**
 * Creates a proxy object of the given class declaration.
 *
 * @param object
 * @param {(method: string, ...args: any[]) => any} callback
 * @returns {{}}
 */
export function createDelegateProxy(object: any, callback: (method: string, ...args: any[]) => any)
{
    const getMethodsFromPrototype = (serviceClass: any) => {
        // Collect all methods from the entire prototype chain.
        let props: any[] = [], obj = serviceClass;
        do {
            props = props.concat(Object.getOwnPropertyNames(obj));
            obj   = Object.getPrototypeOf(obj);
        } while (obj);

        // Filter properties so we're only left with actual methods that
        // exist on the target class.
        return props.sort().filter((e, i, arr) => {
            if (e.startsWith('__') === false
                && [
                    'arguments', 'caller', 'callee', 'constructor', 'hasOwnProperty', 'isPrototypeOf', 'main',
                    'propertyIsEnumerable', 'toLocaleString', 'toString', 'valueOf',
                ].indexOf(e) === -1
                && e !== arr[i + 1]
                && typeof serviceClass[e] === 'function') {
                return true;
            }
        });
    };

    // Hydrate the proxy object with method proxies.
    const proxy: any = {};

    for (const method of getMethodsFromPrototype(object.prototype)) {
        proxy[method] = async (...args: any[]) => await callback(method, args);
    }

    return proxy;
}

export type DelegateProxy = { [name: string]: (...args: any[]) => Promise<any> };
