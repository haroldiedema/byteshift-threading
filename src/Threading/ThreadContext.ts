'use strict';

import {EventEmitter}                          from '@byteshift/events';
import {Inject}                                from '@byteshift/injector';
import {isMainThread, MessagePort, parentPort} from 'worker_threads';
import {EThreadMessageType}                    from './EThreadMessageType';
import {ThreadHost}                            from './ThreadHost';

export class ThreadContext
{
    @Inject private readonly host: ThreadHost;

    public serviceId: string = 'N/A';
    public poolId: number    = null;

    private queue: Map<number, (...args: any[]) => any> = new Map();
    private service: any;

    /**
     * @returns {Promise<void>}
     */
    public async run(): Promise<void>
    {
        if (true === isMainThread) {
            throw new Error('this.run cannot be executed from the main thread.');
        }

        parentPort.on('message', async (message: BareThreadMessage) => {
            switch (message.type) {
                // This thread is being initialized.
                // The main thread sends us which service to initialize which
                // will handle the rest of the functionality of this thread.
                case EThreadMessageType.INIT:
                    this.serviceId = message.svc;
                    this.service   = new (this.host.getClass(message.svc))();
                    this.poolId    = message.poolId || undefined;

                    parentPort.setMaxListeners(256);
                    this.handleRequestMessagesFromPort(parentPort);

                    await this.service.__init__();

                    // Let the main thead know we're ready.
                    parentPort.postMessage({
                        type:      EThreadMessageType.EVENT,
                        eventName: '__running__',
                        eventData: null,
                    });
                    return;

                // A response was received to a message we previously sent to
                // the main thread.
                case EThreadMessageType.RESPONSE:
                    if (!this.queue.has(message.mId)) {
                        // There was no message id in the response, which
                        // means there is no callback to execute.
                        return;
                    }

                    this.queue.get(message.mId)(message.data);
                    this.queue.delete(message.mId);
                    return;

                case EThreadMessageType.CONNECT_PORT:
                    message.port.setMaxListeners(256);
                    this.handleRequestMessagesFromPort(message.port);
                    return;
            }
        });
    }

    /**
     * Handles service request messages from the given port.
     *
     * @param {MessagePort} port
     * @private
     */
    private handleRequestMessagesFromPort(port: MessagePort): void
    {
        port.on('message', async (message: BareThreadMessage) => {
            if (message.type !== EThreadMessageType.REQUEST) {
                return;
            }

            if (typeof this.service[message.name] !== 'function') {
                console.warn(`Method ${message.name} does not exist in thread "${this.serviceId}".`);
                return;
            }

            port.postMessage({
                type:   EThreadMessageType.RESPONSE,
                mId:    message.mId,
                poolId: this.poolId,
                result: await this.service[message.name](...message.args),
            });
        });

        // If the service is an event emitter, proxy all emitted
        // events to the parent port to allow other threads to
        // listen to these events.
        if (this.service instanceof EventEmitter) {
            this.service.on('*', (eventName: string, eventData: any) => {
                port.postMessage({
                    type:      EThreadMessageType.EVENT,
                    eventName: eventName,
                    eventData: eventData,
                });
            });
        }
    }
}

type BareThreadMessage = {
    type: EThreadMessageType,
    mId?: number,
    [name: string]: any
}
