/// <reference types="node" />
import { EventEmitter, EventSubscriber } from '@byteshift/events';
import { TransferListItem, Worker } from 'worker_threads';
import { Thread } from './Thread';
export declare class ThreadDelegate<T> extends EventEmitter {
    private worker;
    readonly svcId: string;
    private port;
    private proxy;
    private queue;
    private pass;
    constructor(serviceClass: (new (...args: any[]) => Thread), worker?: Worker);
    /**
     * Marks an object to be transferred to the target thread during the next
     * delegated method request. The list of transferred objects is cleared
     * automatically once the next delegated method is called.
     *
     * @param {TransferListItem} obj
     */
    transferObject(obj: TransferListItem): void;
    /**
     * Returns a proxy object with methods from the delegated service class.
     */
    get delegate(): T;
    on(eventName: string, callback: (...any: any[]) => any, isOnce?: boolean): EventSubscriber;
    /**
     * Runs the method on the service class.
     *
     * @param {string} methodName
     * @param {any[]} methodArgs
     * @returns {Promise<any>}
     * @private
     */
    private runMethod;
    /**
     * Creates a new port between this thread and the target.
     *
     * @returns {Promise<void>}
     * @private
     */
    private createPort;
    /**
     * Handle response messages on the given emitter.
     *
     * @private
     */
    private handleResponseEventFrom;
    /**
     * Generates a free message ID.
     *
     * @returns {number}
     * @private
     */
    private generateFreeMessageId;
}
