'use strict';

import {EventEmitter}                            from '@byteshift/events';
import {MessageChannel, SHARE_ENV, Worker}       from 'worker_threads';
import {createDelegateProxy, DelegateProxy}      from './DelegateBuilder';
import {EThreadMessageType}                      from './EThreadMessageType';
import {ThreadDelegate}                          from './ThreadDelegate';
import {InstancedThread, Threadable, ThreadHost} from './ThreadHost';

export class ThreadPool<T> extends EventEmitter
{
    private threads: Map<number, PooledThread<T>> = new Map();
    private proxy: DelegateProxy;

    constructor(
        private host: ThreadHost,
        private serviceClass: Threadable,
        private threadCount: number,
        private onBusyCallback: () => void,
        private bootstrapFile: string,
        private exitCleanlyOnThreadCrash: boolean = false,
    )
    {
        super();

        this.proxy = createDelegateProxy(
            serviceClass,
            (method: string, args: any[]) => this.runMethod(method, args),
        );
    }

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
    public onBusy(callback: () => any): void
    {
        this.onBusyCallback = callback;
    }

    /**
     * Returns true if there are currently idle threads.
     *
     * @returns {boolean}
     */
    public get hasIdleThreads(): boolean
    {
        for (const thread of this.threads.values()) {
            if (! thread.isBusy) {
                return true;
            }
        }

        return false;
    }

    /**
     * Returns the number of busy threads.
     *
     * @returns {number}
     */
    public get busyThreadCount(): number
    {
        let counter = 0;
        for (const thread of this.threads.values()) {
            if (thread.isBusy) {
                counter++;
            }
        }

        return counter;
    }

    /**
     * Returns true if all threads inside this pool are fully initialized and
     * operational.
     *
     * @returns {boolean}
     */
    public get isStarted(): boolean
    {
        for (let thread of this.threads.values()) {
            if (!thread.isRunning) {
                return false;
            }
        }

        return true;
    }

    /**
     * Returns a delegate object used to invoke methods of threads within
     * this pool.
     */
    public get delegate(): T
    {
        return this.proxy as any;
    }

    /**
     * Returns the service class.
     *
     * @returns {Threadable}
     */
    public get service(): Threadable
    {
        return this.serviceClass;
    }

    /**
     * Starts the threads in the thread pool.
     *
     * @returns {Promise<void>}
     */
    public start(): Promise<void>
    {
        let onlineCount = 0, resolve: () => void;
        this.on('childOnline', () => {
            onlineCount++;
            if (onlineCount === this.threadCount) {
                resolve();
            }
        });

        return new Promise((r) => {
            resolve = r;

            for (let i = 0; i < this.threadCount; i++) {
                this.threads.set(i + 1, this.spawnThread(i + 1));
            }
        });
    }

    /**
     * Spawns a single thread in the pool.
     *
     * @param {number} id
     * @returns {Promise<void>}
     * @private
     */
    private spawnThread(id: number): PooledThread<any>
    {
        const worker = new Worker(this.bootstrapFile, {env: SHARE_ENV});
        const thread = new ThreadDelegate<any>(this.serviceClass as any, worker);

        this.configureMultiThreadCommunicationEvents(worker);

        const pooledThread: PooledThread<any> = {
            id:        id,
            worker:    worker,
            thread:    thread,
            isRunning: false,
            isBusy:    false,
            queue:     new Set(),
        };

        worker.on('error', (err) => {
            this.emit('log', {
                level:   'emergency',
                message: `Thread "${this.serviceClass.name}" crashed. Error: ${err.message}. Trace: ${err.stack}`,
            });

            setTimeout(() => {
                process.exit(this.exitCleanlyOnThreadCrash ? 0 : 1);
            }, 1000);
        });

        worker.on('online', () => {
            this.emit('log', {
                level:   'debug',
                message: `Service thread #${worker.threadId} "${this.serviceClass.name}" is online.`,
            });

            this.host.emit('add', {
                thread: thread,
                worker: worker,
                service: this.serviceClass
            } as InstancedThread);
        });

        worker.on('exit', () => {
            this.emit('log', {
                level:   'warning',
                message: `Service thread "${this.serviceClass.name}" is terminated.`,
            });
        });

        worker.postMessage({
            type:   EThreadMessageType.INIT,
            svc:    this.serviceClass.name,
            poolId: id,
        });

        thread.once('__running__', async () => {
            this.emit('log', {
                level:   'debug',
                message: `Service thread #${worker.threadId} "${this.serviceClass.name}" is successfully initialized.`,
            });

            pooledThread.isRunning = true;
            this.emit('childOnline', pooledThread);
        });

        return pooledThread;
    }

    /**
     * Runs a method on the least-busy thread.
     */
    private async runMethod(methodName: string, args: any[]): Promise<any>
    {
        const thread = this.findFreeThread();
        if (thread.isBusy && typeof this.onBusyCallback === 'function') {
            return this.onBusyCallback();
        }

        return new Promise((resolve) => {
            thread.queue.add(resolve);
            thread.isBusy = true;
            this.emit('tick');

            (thread.thread.delegate as any)[methodName](...args).then((data: any) => {
                thread.queue.delete(resolve);
                thread.isBusy = false;
                resolve(data);
                this.emit('tick');
            }).catch((e: any) => {
                // FIXME: What do we want to do here?
                console.error(e);
            });
        });
    }

    /**
     * Returns a free thread to operate on.
     *
     * If there are no idle threads, the thread with the least amount of queued
     * requests is returned instead. Use {thread.isBusy} to detect whether all
     * threads are currently busy.
     */
    private findFreeThread(): PooledThread<T>
    {
        let chosenThread,
            queueCount = Infinity;

        for (let thread of this.threads.values()) {
            // If the thread is idle, return it immediately.
            if (!thread.isBusy) {
                return thread;
            }

            // Find the least busy thread (minimum amount of queued calls).
            if (queueCount > thread.queue.size) {
                queueCount   = thread.queue.size;
                chosenThread = thread;
            }
        }

        return chosenThread;
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
            const targetThread   = await this.host.getWorkerByName(message.data.svcId);

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

type PooledThread<T> = {
    id: number;
    isRunning: boolean;
    isBusy: boolean;
    thread: ThreadDelegate<T>;
    worker: Worker;
    queue: Set<(...args: any[]) => any>;
}

type BareThreadMessage = {
    type: EThreadMessageType,
    mId?: number,
    [name: string]: any
}
