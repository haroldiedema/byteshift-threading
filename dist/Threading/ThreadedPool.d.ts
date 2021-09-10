/**
 * Registers the given constructor as a thread.
 * Use the @Delegate annotation on class properties to dynamically inject a singleton instance of the registered thread.
 * The property type is used to determine which service instance should be injected.
 *
 * @decorator
 */
export declare function ThreadedPool(poolCount: number, autoStart?: boolean): (constructor: any) => void;
