'use strict';

import {EventEmitter, EventSubscriber}                                   from '@byteshift/events';
import {isMainThread, MessagePort, parentPort, TransferListItem, Worker} from 'worker_threads';
import {createDelegateProxy, DelegateProxy}                              from './DelegateBuilder';
import {EThreadMessageType}                                              from './EThreadMessageType';
import {Thread}                                                          from './Thread';

export class ThreadDelegate<T> extends EventEmitter
{
    public readonly svcId: string;

    private port: MessagePort;
    private proxy: DelegateProxy                        = {};
    private queue: Map<number, (...args: any[]) => any> = new Map();
    private pass: TransferListItem[]                    = [];

    constructor(serviceClass: (new (...args: any[]) => Thread), private worker: Worker = null)
    {
        super();

        this.svcId = serviceClass.name;
        this.proxy = createDelegateProxy(
            serviceClass,
            (method: string, args: any[]) => this.runMethod(method, args),
        );

        if (isMainThread) {
            if (this.worker) {
                this.handleResponseEventFrom(worker);
            }
        } else {
            this.handleResponseEventFrom(parentPort);
        }
    }

    /**
     * Marks an object to be transferred to the target thread during the next
     * delegated method request. The list of transferred objects is cleared
     * automatically once the next delegated method is called.
     *
     * @param {TransferListItem} obj
     */
    public transferObject(obj: TransferListItem): void
    {
        this.pass.push(obj);
    }

    /**
     * Returns a proxy object with methods from the delegated service class.
     */
    public get delegate(): T
    {
        // Cast to any to allow re-cast to generic<T>.
        return this.proxy as any;
    }

    public on(eventName: string, callback: (...any: any[]) => any, isOnce?: boolean): EventSubscriber
    {
        if (!isMainThread && !this.port) {
            this.createPort().then(() => { /* NO-OP */
            });
        }

        return super.on(eventName, callback, isOnce);
    }

    /**
     * Runs the method on the service class.
     *
     * @param {string} methodName
     * @param {any[]} methodArgs
     * @returns {Promise<any>}
     * @private
     */
    private async runMethod(methodName: string, methodArgs: any[]): Promise<any>
    {
        if (isMainThread) {
            // We're being executed from the main thread. Pass the request to
            // the active worker instance and wait for a response...
            return new Promise((resolve) => {

                if (!this.worker) {
                    throw new Error(`Unable to call ${methodName}(). ${this.svcId} has not been started.`);
                }

                const messageId = this.generateFreeMessageId();
                this.queue.set(messageId, resolve);

                this.worker.postMessage({
                    type: EThreadMessageType.REQUEST,
                    mId:  messageId,
                    name: methodName,
                    args: methodArgs,
                }, this.pass);

                this.pass = [];
            });
        }

        // We're being executed from a worker.
        // Do we already have an open port to the target thread?
        if (undefined === this.port) {
            // Create a new port from this thread to the target thread.
            await this.createPort();
        }

        // Store the resolve function in the message queue while we wait for
        // a response from the other thread.
        return new Promise((resolve) => {
            const messageId = this.generateFreeMessageId();
            this.queue.set(messageId, resolve);

            this.port.postMessage({
                type: EThreadMessageType.REQUEST,
                mId:  messageId,
                name: methodName,
                args: methodArgs,
            }, this.pass);

            this.pass = [];
        });
    }

    /**
     * Creates a new port between this thread and the target.
     *
     * @returns {Promise<void>}
     * @private
     */
    private async createPort(): Promise<void>
    {
        return new Promise((resolve) => {
            const id = this.generateFreeMessageId();

            this.queue.set(id, (port: MessagePort) => {
                this.port = port;
                this.handleResponseEventFrom(port);
                resolve();
            });

            parentPort.postMessage({
                type: EThreadMessageType.CREATE_PORT,
                mId:  id,
                data: {svcId: this.svcId},
            });
        });
    }

    /**
     * Handle response messages on the given emitter.
     *
     * @private
     */
    private handleResponseEventFrom(eventEmitter: any): void
    {
        eventEmitter.setMaxListeners(256);
        eventEmitter.on('message', (message: BareThreadMessage) => {
            switch (message.type) {
                case EThreadMessageType.RESPONSE:
                    if (this.queue.has(message.mId)) {
                        this.queue.get(message.mId)(message.result);
                        this.queue.delete(message.mId);
                    }
                    return;
                case EThreadMessageType.EVENT:
                    this.emit(message.eventName, message.eventData);
                    return;
            }
        });
    }

    /**
     * Generates a free message ID.
     *
     * @returns {number}
     * @private
     */
    private generateFreeMessageId(): number
    {
        const id = Math.floor(Math.random() * 2147483646);

        if (this.queue.has(id)) {
            return this.generateFreeMessageId();
        }

        return id;
    }
}

type BareThreadMessage = {
    type: EThreadMessageType,
    mId?: number,
    [name: string]: any
}
