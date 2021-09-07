import { EventEmitter } from '@byteshift/events';
import { Threadable, ThreadHost } from './ThreadHost';
export declare class ThreadPool<T> extends EventEmitter {
    private host;
    private serviceClass;
    private threadCount;
    private onBusyCallback;
    private bootstrapFile;
    private exitCleanlyOnThreadCrash;
    private threads;
    private proxy;
    constructor(host: ThreadHost, serviceClass: Threadable, threadCount: number, onBusyCallback: () => void, bootstrapFile: string, exitCleanlyOnThreadCrash?: boolean);
    /**
     * Invokes the given callback when all threads are currently busy while a
     * new request is being made to one of the threads.
     *
     * If this value is a function, requested method calls will no longer be
     * queued onto the least busy threads. If a delegated method is invoked
     * while all threads are busy, the method will return {undefined}
     * immediately until the busy callback is set to NULL.
     *
     * Listen to the 'tick' event on the thread pool to detect whether threads
     * are available for processing again.
     *
     * @param {() => any} callback
     */
    onBusy(callback: () => any): void;
    /**
     * Returns true if there are currently idle threads.
     *
     * @returns {boolean}
     */
    get hasIdleThreads(): boolean;
    /**
     * Returns the number of busy threads.
     *
     * @returns {number}
     */
    get busyThreadCount(): number;
    /**
     * Returns true if all threads inside this pool are fully initialized and
     * operational.
     *
     * @returns {boolean}
     */
    get isStarted(): boolean;
    /**
     * Returns a delegate object used to invoke methods of threads within
     * this pool.
     */
    get delegate(): T;
    /**
     * Returns the service class.
     *
     * @returns {Threadable}
     */
    get service(): Threadable;
    /**
     * Starts the threads in the thread pool.
     *
     * @returns {Promise<void>}
     */
    start(): Promise<void>;
    /**
     * Spawns a single thread in the pool.
     *
     * @param {number} id
     * @returns {Promise<void>}
     * @private
     */
    private spawnThread;
    /**
     * Runs a method on the least-busy thread.
     */
    private runMethod;
    /**
     * Returns a free thread to operate on.
     *
     * If there are no idle threads, the thread with the least amount of queued
     * requests is returned instead. Use {thread.isBusy} to detect whether all
     * threads are currently busy.
     */
    private findFreeThread;
    /**
     * Handles the CREATE_PORT event to set-up direct communication between
     * two different threads.
     *
     * @param {Worker} worker
     * @private
     */
    private configureMultiThreadCommunicationEvents;
}
