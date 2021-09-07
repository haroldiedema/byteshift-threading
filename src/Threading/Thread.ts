'use strict';

import {EventEmitter} from '@byteshift/events';

export abstract class Thread extends EventEmitter
{
    /**
     * @returns {Promise<string>}
     */
    public async ping(): Promise<string>
    {
        return 'pong';
    }

    /**
     * Main entry-point for this thread.
     *
     * This method is invoked on first start-up of the thread just like a
     * class constructor.
     *
     * @returns {Promise<void>}
     */
    public abstract __init__(): Promise<void>;
}
