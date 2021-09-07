'use strict';

import {ServiceHost}    from '@byteshift/injector';
import {isMainThread}   from 'worker_threads';
import {ThreadDelegate} from './ThreadDelegate';
import {ThreadHost}     from './ThreadHost';

/**
 * Injects a thread delegate of the typed service.
 *
 * @decorator
 */
export function Delegate(target: (new (...args: any[]) => any)): any
{
    return function (constructor: new (...args: any[]) => any, propertyKey: string) {
        let _instance: ThreadDelegate<any>;

        Object.defineProperty(constructor, propertyKey, {
            configurable: false,
            enumerable:   false,
            get:          () => {
                if (! _instance) {
                    if (isMainThread) {
                        _instance = new ThreadDelegate<any>(target, ServiceHost.get(ThreadHost).getWorkerByName(target.name));
                    } else {
                        _instance = new ThreadDelegate<any>(target);
                    }
                }

                return _instance;
            }
        });
    }
}

export function DelegatePool(target: (new (...args: any[]) => any)): any
{
    return function (constructor: new (...args: any[]) => any, propertyKey: string) {
        Object.defineProperty(constructor, propertyKey, {
            configurable: false,
            enumerable: false,
            get: () => {
                if (! isMainThread) {
                    throw new Error('A thread pool can only be accessed from the main thread.');
                }

                return ServiceHost.get(ThreadHost).getPool(target);
            }
        });
    }
}
