import { EventEmitter } from '@byteshift/events';
export declare abstract class Thread extends EventEmitter {
    /**
     * @returns {Promise<string>}
     */
    ping(): Promise<string>;
    /**
     * Main entry-point for this thread.
     *
     * This method is invoked on first start-up of the thread just like a
     * class constructor.
     *
     * @returns {Promise<void>}
     */
    abstract __init__(): Promise<void>;
}
