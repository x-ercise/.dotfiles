//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const checkArg_1 = require("./checkArg");
/**
 * RPC variables are intentionally NOT private members of public API objects,
 * to prevent extensions from trivially using the private members to make
 * arbitrary RPC calls.
 */
const rpc = {
    connection: null,
};
/**
 * Implements both the service and service proxy interfaces.
 */
class SharedServiceApi {
    constructor(name, connection, trace) {
        this.name = name;
        this.trace = trace;
        this.isAvailable = false;
        this.isAvailableChange = new vscode_1.EventEmitter();
        checkArg_1.default(connection, 'connection', 'object');
        rpc.connection = connection;
        // Ensure the name property cannot be modified.
        Object.defineProperty(this, 'name', {
            enumerable: false,
            configurable: false,
            writable: false,
        });
    }
    get isServiceAvailable() { return this.isAvailable; }
    get onDidChangeIsServiceAvailable() {
        return this.isAvailableChange.event;
    }
    /* internal */ set _isServiceAvailable(value) {
        this.isAvailable = value;
    }
    /* internal */ _fireIsAvailableChange() {
        this.trace.verbose(`^onDidChangeIsServiceAvailable(${this.name}, ${this.isAvailable})`);
        this.isAvailableChange.fire(this.isAvailable);
    }
    onRequest(name, handler) {
        checkArg_1.default(name, 'name', 'string');
        checkArg_1.default(handler, 'handler', 'function');
        const rpcName = this.makeRpcName(name);
        this.trace.verbose(`onRequest(${rpcName})`);
        rpc.connection.onRequest(rpcName, (...args) => {
            this.trace.verbose(`rpc.onRequest(${rpcName})`);
            // The request ID was inserted into the args by the read filter. (It's not used here.)
            args.splice(0, 1);
            // Separate the cancellation token from the end of the args array.
            const [cancellation] = args.splice(args.length - 1, 1);
            try {
                return handler(args, cancellation);
            }
            catch (e) {
                this.trace.warning(`Request handler (${rpcName}) failed: ` + e.message);
                let stack = e.stack;
                if (stack) {
                    // Strip off the part of the stack that is not in the extension code.
                    stack = stack.replace(new RegExp('\\s+at ' + SharedServiceApi.name + '(.*\n?)+'), '');
                }
                return new vscode_jsonrpc_1.ResponseError(vscode_jsonrpc_1.ErrorCodes.UnknownErrorCode, e.message, stack);
            }
        });
    }
    onNotify(name, handler) {
        checkArg_1.default(name, 'name', 'string');
        checkArg_1.default(handler, 'handler', 'function');
        const rpcName = this.makeRpcName(name);
        this.trace.verbose(`onNotify(${rpcName})`);
        rpc.connection.onNotification(rpcName, (...argsArray) => {
            const args = argsArray[0];
            this.trace.verbose(`rpc.onNotify(${rpcName})`);
            try {
                handler(args);
            }
            catch (e) {
                this.trace.warning(`Notification handler (${rpcName}) failed: ` + e.message);
                // Notifications have no response, so no error details are returned.
            }
        });
    }
    async request(name, args, cancellation) {
        checkArg_1.default(name, 'name', 'string');
        checkArg_1.default(args, 'args', 'array');
        const rpcName = this.makeRpcName(name);
        if (!this.isServiceAvailable) {
            this.trace.warning(`request(${rpcName}) - service not available`);
            throw new SharedServiceProxyError('Service \'' + this.name + '\' is not available.');
        }
        this.trace.verbose(`request(${rpcName})`);
        let responsePromise;
        try {
            // The vscode-jsonrpc sendRequest() method can only detect a cancellation token argument
            // if it is not null.
            if (cancellation) {
                responsePromise = rpc.connection.sendRequest(rpcName, args, cancellation);
            }
            else {
                responsePromise = rpc.connection.sendRequest(rpcName, args);
            }
        }
        catch (e) {
            this.trace.warning(`request(${rpcName}) failed: ` + e.message);
            throw new SharedServiceProxyError(e.message);
        }
        let response;
        try {
            response = await responsePromise;
        }
        catch (e) {
            this.trace.warning(`request(${rpcName}) failed: ` + e.message);
            throw new SharedServiceResponseError(e.message, e.data);
        }
        this.trace.verbose(`request(${rpcName}) succeeded`);
        return response;
    }
    notify(name, args) {
        checkArg_1.default(name, 'name', 'string');
        checkArg_1.default(args, 'args', 'object');
        const rpcName = this.makeRpcName(name);
        if (!this.isServiceAvailable) {
            this.trace.verbose(`notify(${rpcName}) - service not available`);
            // Notifications do nothing when the service is not available.
            return;
        }
        this.trace.verbose(`notify(${rpcName})`);
        try {
            rpc.connection.sendNotification(rpcName, [args]);
        }
        catch (e) {
            this.trace.warning(`notify(${rpcName}) failed: ` + e.message);
            throw new SharedServiceProxyError(e.message);
        }
    }
    makeRpcName(name) {
        return this.name + '.' + name;
    }
}
exports.SharedServiceApi = SharedServiceApi;
class SharedServiceProxyError extends Error {
    constructor(message) {
        super(message);
        this.name = SharedServiceProxyError.name;
    }
}
exports.SharedServiceProxyError = SharedServiceProxyError;
class SharedServiceResponseError extends Error {
    constructor(message, remoteStack) {
        super(message);
        this.remoteStack = remoteStack;
        this.name = SharedServiceResponseError.name;
    }
}
exports.SharedServiceResponseError = SharedServiceResponseError;

//# sourceMappingURL=sharedServiceApi.js.map
