export declare class ThreadContext {
    private readonly host;
    serviceId: string;
    poolId: number;
    private queue;
    private service;
    /**
     * @returns {Promise<void>}
     */
    run(): Promise<void>;
    /**
     * Handles service request messages from the given port.
     *
     * @param {MessagePort} port
     * @private
     */
    private handleRequestMessagesFromPort;
}
