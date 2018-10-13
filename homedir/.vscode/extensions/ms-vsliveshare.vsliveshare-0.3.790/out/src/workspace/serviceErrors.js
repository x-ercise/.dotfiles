"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Error thrown from RPC requests when the connection to the agent was unexpectedly
 * closed before or during the request.
 */
class RpcConnectionClosedError extends Error {
    constructor() {
        super('RPC connection closed.');
        this.code = RpcConnectionClosedError.code;
        Object.setPrototypeOf(this, RpcConnectionClosedError.prototype);
    }
}
/** One of the well-known Node.js error code strings. */
RpcConnectionClosedError.code = 'EPIPE';
exports.RpcConnectionClosedError = RpcConnectionClosedError;
/**
 * Error thrown from RPC connection is closed due to explicit client shut down.
 */
class RpcConnectionShutdownError extends Error {
    constructor() {
        super('RPC connection closed due to client shut down.');
        this.code = RpcConnectionShutdownError.code;
        Object.setPrototypeOf(this, RpcConnectionShutdownError.prototype);
    }
}
/** One of the well-known Node.js error code strings. */
RpcConnectionShutdownError.code = 'ECONNRESET';
exports.RpcConnectionShutdownError = RpcConnectionShutdownError;

//# sourceMappingURL=serviceErrors.js.map
