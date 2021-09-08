'use strict';

import {EventEmitter}                                    from '@byteshift/events';
import {isMainThread, MessageChannel, SHARE_ENV, Worker} from 'worker_threads';
import {EThreadMessageType}                              from './EThreadMessageType';
import {Thread}                                          from './Thread';
import {ThreadDelegate}                                  from './ThreadDelegate';
import {ThreadPool}                                      from './ThreadPool';

export type Threadable = (new (...args: any[]) => Thread);

const _G: any = (typeof window !== 'undefined' ? window : global);

export class ThreadHost extends EventEmitter
{
    private exitCleanlyOnThreadCrash: boolean   = false;
    private bootstrapFile: string               = null;
    private services: ServiceCollection         = new Map();
    private pools: Map<string, ThreadPool<any>> = new Map();

    public static getInstance(): ThreadHost
    {
        if (typeof _G['__ByteshiftThreading__'] !== 'undefined') {
            return _G['__ByteshiftThreading__'];
        }

        _G['__ByteshiftThreading__'] = new ThreadHost();
    }

    constructor()
    {
        super();

        if (typeof _G['__ByteshiftThreading__'] !== 'undefined') {
            throw new Error('Use ThreadHost.getInstance() to grab an instance of the ThreadHost.');
        }
    }

    /**
     * @param {string} bootstrapFile
     * @param {boolean} exitCleanlyOnThreadCrash
     */
    public initialize(bootstrapFile: string, exitCleanlyOnThreadCrash: boolean = false): void
    {
        this.bootstrapFile            = bootstrapFile;
        this.exitCleanlyOnThreadCrash = exitCleanlyOnThreadCrash;
    }

    /**
     * Registers one or more new threads.
     */
    public register(...serviceClasses: Threadable[]): void
    {
        if (!this.bootstrapFile) {
            throw new Error(
                `Unable to register a threadable class without initializing the ThreadHost first. Please call .initialize() first.`
            );
        }

        serviceClasses.forEach((serviceClass: Threadable) => {
            if (this.services.has(serviceClass.name)) {
                throw new Error(`Another threaded service with the name "${serviceClass.name}" is already registered.`);
            }

            this.services.set(serviceClass.name, {service: serviceClass, thread: null, worker: null});
        });
    }

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
    public registerPool(serviceClass: Threadable, threadCount: number, onBusyCallback?: () => void): void
    {
        if (!this.bootstrapFile) {
            throw new Error(
                `Unable to register a thread pool without initializing the ThreadHost first. Please call .initialize() first.`
            );
        }

        if (this.pools.has(serviceClass.name)) {
            throw new Error(`Another thread pool already exists for service class "${serviceClass.name}".`);
        }

        this.pools.set(
            serviceClass.name,
            new ThreadPool<typeof serviceClass>(this, serviceClass, threadCount, onBusyCallback, this.bootstrapFile, this.exitCleanlyOnThreadCrash),
        );
    }

    /**
     * Returns a thread delegate of the given service class.
     *
     * @param {{new(...args: any[]): any}} serviceClass
     * @returns {Promise<ThreadDelegate<T>>}
     */
    public get<T>(serviceClass: (new (...args: any[]) => T)): ThreadDelegate<T>
    {
        if (!isMainThread) {
            throw new Error('A child thread can only be retrieved from the main thread.');
        }

        if (false === this.services.has(serviceClass.name)) {
            throw new Error(`Thread "${serviceClass.name}" does not exist or is not registered.`);
        }

        if (!this.services.get(serviceClass.name).thread) {
            throw new Error(`Unable to retrieve thread "${serviceClass.name}" because it is not started.`);
        }

        return this.services.get(serviceClass.name).thread;
    }

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
    public getPool<T>(serviceClass: (new (...args: any[]) => T)): ThreadPool<T>
    {
        if (!isMainThread) {
            throw new Error('A thread pool can only be retrieved from the main thread.');
        }

        if (false === this.pools.has(serviceClass.name)) {
            throw new Error(`A thread pool for "${serviceClass.name}" does not exist or is not registered.`);
        }

        const pool = this.pools.get(serviceClass.name);

        if (false === pool.isStarted) {
            throw new Error(`Thread pool for service "${serviceClass.name}" has not been started.`);
        }

        return pool;
    }

    /**
     * Starts the given threads.
     *
     * @param {{new(...args: any[]): Thread}} serviceClasses
     * @returns {Promise<void>}
     */
    public async start(...serviceClasses: Threadable[]): Promise<void>
    {
        if (!isMainThread) {
            throw new Error('A thread can only be started from the main thread.');
        }

        for (let serviceClass of serviceClasses) {
            await this._start(serviceClass);
        }
    }

    /**
     * Starts the given thread pools.
     *
     * @param {Threadable} serviceClasses
     * @returns {Promise<void>}
     */
    public async startPool(...serviceClasses: Threadable[]): Promise<void>
    {
        if (!isMainThread) {
            throw new Error('A thread pool can only be started from the main thread.');
        }

        for (let serviceClass of serviceClasses) {
            if (!this.pools.has(serviceClass.name)) {
                throw new Error(`There is no thread pool for service class "${serviceClass.name}".`);
            }

            await this.pools.get(serviceClass.name).start();
        }
    }

    private _start(serviceClass: Threadable): Promise<any>
    {
        const fileName = this.bootstrapFile;

        return new Promise((resolve) => {
            const worker = new Worker(fileName, {env: SHARE_ENV});
            const thread = new ThreadDelegate<any>(serviceClass as any, worker);

            worker.on('error', (err) => {
                this.emit('log', {
                    level:   'emergency',
                    message: `Thread "${serviceClass.name}" crashed. Error: ${err.message}. Trace: ${err.stack}`,
                });

                setTimeout(() => {
                    process.exit(this.exitCleanlyOnThreadCrash ? 1 : 0);
                }, 1000);
            });

            worker.on('online', () => {
                this.emit('log', {
                    level:   'debug',
                    message: `Service thread #${worker.threadId} "${serviceClass.name}" is online.`,
                });

                this.emit('add', this.services.get(serviceClass.name));
            });

            worker.on('exit', () => {
                this.emit('log', {
                    level:   'warning',
                    message: `Service thread "${serviceClass.name}" is terminated.`,
                });
                this.emit('remove', this.services.get(serviceClass.name));
            });

            this.configureMultiThreadCommunicationEvents(worker);

            this.services.get(serviceClass.name).thread = thread;
            this.services.get(serviceClass.name).worker = worker;

            worker.postMessage({
                type: EThreadMessageType.INIT,
                svc:  serviceClass.name,
            });

            thread.once('__running__', async () => {
                this.emit('log', {
                    level:   'debug',
                    message: `Service thread #${worker.threadId} "${serviceClass.name}" is successfully initialized.`,
                });
                resolve(thread);
            });
        });
    }

    /**
     * Returns a worker instance by the given name.
     *
     * @param {string} name
     * @returns {Worker}
     */
    public getWorkerByName(name: string): Worker
    {
        if (!isMainThread) {
            throw new Error(`A child thread attempted to fetch the worker for service "${name}" directly.`);
        }

        const service = this.services.get(name);
        if (!service) {
            throw new Error(`The worker for "${name}" is offline.`);
        }

        return service.worker;
    }

    /**
     * Returns the service class by the given name.
     *
     * @param {string} name
     * @returns {any}
     */
    public getClass(name: string): any
    {
        if (false === this.services.has(name)) {
            if (false === this.pools.has(name)) {
                throw new Error(`Threadable service "${name}" does not exist.`);
            }

            return this.pools.get(name).service;
        }

        return this.services.get(name).service;
    }

    /**
     * Handles the CREATE_PORT event to set-up direct communication between
     * two different threads.
     *
     * @param {Worker} worker
     * @private
     */
    private configureMultiThreadCommunicationEvents(worker: Worker)
    {
        worker.on('message', async (message: BareThreadMessage) => {
            if (message.type !== EThreadMessageType.CREATE_PORT) {
                return;
            }

            const {port1, port2} = new MessageChannel();
            const targetThread   = await this.getWorkerByName(message.data.svcId);

            // Pass the new port to the target.
            targetThread.postMessage({
                type: EThreadMessageType.CONNECT_PORT,
                port: port2,
            }, [port2]);

            // Pass the new port back to the caller.
            worker.postMessage({
                type:   EThreadMessageType.RESPONSE,
                mId:    message.mId,
                poolId: message.poolId || undefined,
                result: port1,
            }, [port1]);
        });
    }
}

export type InstancedThread = {
    service: (new (...args: any[]) => any),
    thread: ThreadDelegate<any>,
    worker: Worker
};

type ServiceCollection = Map<string, InstancedThread>;

type BareThreadMessage = {
    type: EThreadMessageType,
    mId?: number,
    [name: string]: any
}
