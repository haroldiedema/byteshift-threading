'use strict';

import { ThreadHost } from './ThreadHost';

/**
 * Registers the given constructor as a thread.
 * Use the @Delegate annotation on class properties to dynamically inject a singleton instance of the registered thread.
 * The property type is used to determine which service instance should be injected.
 *
 * @decorator
 */
export function Threaded(autoStart?: boolean) {
    autoStart = autoStart !== undefined ? autoStart : true;
    return function (target: any) {
        ThreadHost.getInstance().registerAnnotation(autoStart, target);
    }
}