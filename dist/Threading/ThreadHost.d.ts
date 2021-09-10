/// <reference types="node" />
import { EventEmitter } from '@byteshift/events';
import { Worker } from 'worker_threads';
import { Thread } from './Thread';
import { ThreadDelegate } from './ThreadDelegate';
import { ThreadPool } from './ThreadPool';
export declare type Threadable = (new (...args: any[]) => Thread);
export declare class ThreadHost extends EventEmitter {
    private exitCleanlyOnThreadCrash;
    private bootstrapFile;
    private services;
    private pools;
    private annotatedServices;
    private annotatedPools;
    static getInstance(): ThreadHost;
    constructor();
    /**
     * @param {string} bootstrapFile
     * @param {boolean} exitCleanlyOnThreadCrash
     */
    initialize(bootstrapFile: string, exitCleanlyOnThreadCrash?: boolean): void;
    /**
     * Registers one or more new threads.
     */
    register(...serviceClasses: Threadable[]): void;
    /**
     * Registers an annotated thread.
     */
    registerAnnotation(autostart: boolean, serviceClass: Threadable): void;
    /**
     * Registers a service class to run in a pool of threads.
     *
     * Each call made to the service class is delegated to a thread that is
     * currently idle. If the onBusyCallback is provided and all threads are
     * busy when sending a request, this callback will be invoked, allowing
     * rate-limit behavior to be implemented. If this value is omitted, the
     * request is sent to the thread that was busy the longest, since it will
     * most likely be ready first.
     *
     * @param {Threadable} serviceClass
     * @param {number} threadCount
     * @param {function} onBusyCallback
     */
    registerPool(serviceClass: Threadable, threadCount: number, onBusyCallback?: () => void): void;
    /**
     * Registers an annotated thread pool.
     */
    registerPoolAnnotation(autostart: boolean, serviceClass: Threadable, threadCount: number, onBusyCallback?: () => void): void;
    /**
     * Returns a thread delegate of the given service class.
     *
     * @param {{new(...args: any[]): any}} serviceClass
     * @returns {Promise<ThreadDelegate<T>>}
     */
    get<T>(serviceClass: (new (...args: any[]) => T)): ThreadDelegate<T>;
    /**
     * Returns a ThreadPool instance associated with the given service class.
     *
     * The thread pool must be fully initialized and started before it is
     * accessible. Attempting to access the pool before this time will throw an
     * error.
     *
     * This method can only be used from the main thread.
     *
     * @param {{new(...args: any[]): T}} serviceClass
     * @returns {ThreadPool<T>}
     */
    getPool<T>(serviceClass: (new (...args: any[]) => T)): ThreadPool<T>;
    /**
     * Starts the given threads.
     *
     * @param {{new(...args: any[]): Thread}} serviceClasses
     * @returns {Promise<void>}
     */
    start(...serviceClasses: Threadable[]): Promise<void>;
    /**
     * Starts the given thread pools.
     *
     * @param {Threadable} serviceClasses
     * @returns {Promise<void>}
     */
    startPool(...serviceClasses: Threadable[]): Promise<void>;
    private _start;
    /**
     * Returns a worker instance by the given name.
     *
     * @param {string} name
     * @returns {Worker}
     */
    getWorkerByName(name: string): Worker;
    /**
     * Returns the service class by the given name.
     *
     * @param {string} name
     * @returns {any}
     */
    getClass(name: string): any;
    /**
     * Handles the CREATE_PORT event to set-up direct communication between
     * two different threads.
     *
     * @param {Worker} worker
     * @private
     */
    private configureMultiThreadCommunicationEvents;
}
export declare type InstancedThread = {
    service: (new (...args: any[]) => any);
    thread: ThreadDelegate<any>;
    worker: Worker;
};
