//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const url = require("url");
const rpc = require("vscode-jsonrpc");
const net = require("net");
const traceSource_1 = require("../tracing/traceSource");
const util_1 = require("../util");
const agent_1 = require("../agent");
const telemetry_1 = require("../telemetry/telemetry");
const telemetryStrings_1 = require("../telemetry/telemetryStrings");
const rpcUtils_1 = require("../utils/rpcUtils");
const serviceErrors_1 = require("./serviceErrors");
class RPCClient {
    constructor(uriPromise) {
        this.maxRetryCount = 9;
        this.rpcRequestsWithContext = new rpcUtils_1.RpcRequestsWithContext();
        this.starRequests = {};
        this.starNotificationsCookies = 0;
        this.starNotifications = new Map();
        this.rpcReadFilters = [this.rpcRequestsWithContext.readFilter];
        this.rpcWriteFilters = [];
        this.progressHandlers = new Map();
        this.dispose = (e) => {
            if (!this.disposed) {
                if (this.connection) {
                    this.connection.dispose();
                    this.connection = null;
                }
                if (this.socket) {
                    this.socket.destroy();
                    this.socket = null;
                }
                this.disposed = true;
                if (e) {
                    this.initPromise = Promise.reject(e);
                }
                else {
                    // The instance was disposed during extension deactivation.
                    // Create an init promise that never resolves, to block any
                    // further communication attempts during extension deactivation.
                    this.initPromise = new Promise((resolve) => { });
                }
            }
        };
        this.trace = traceSource_1.traceSource.withName(traceSource_1.TraceSources.ClientRpc);
        // Start but don't await yet. Save the promise for later.
        this.uriPromise = uriPromise || agent_1.Agent.startIfNotRunning();
        this.addProgressFilters();
    }
    get isDisposed() {
        return this.disposed;
    }
    async init(retryCount = this.maxRetryCount, retryInterval = null) {
        const currentRetryInterval = retryInterval || (retryCount === this.maxRetryCount ? 50 : 100);
        this.uri = await this.uriPromise;
        await new Promise((resolve, reject) => {
            let startEvent = telemetry_1.Instance.startTimedEvent(telemetryStrings_1.TelemetryEventNames.START_AGENT_CONNECTION);
            startEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.AGENT_START_CONNECTION_RETRY_COUNT, (this.maxRetryCount - retryCount).toString());
            startEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.AGENT_START_CONNECTION_URI_PROTOCOL, this.uri.protocol);
            startEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.AGENT_START_CONNECTION_OWNER, this.connectionOwner || 'client');
            let didSucceed = false;
            if (this.uri.protocol === 'net.tcp:' &&
                this.uri.hostname === 'localhost' &&
                this.uri.port) {
                const port = parseInt(this.uri.port, 10);
                this.socket = net.createConnection({ port: port });
            }
            else if (this.uri.protocol === 'net.pipe:' && this.uri.hostname === 'localhost') {
                const pipe = this.uri.pathname.substr(1);
                this.socket = net.createConnection(util_1.getPipePath(pipe));
            }
            else {
                reject(new Error('Invalid agent URI: ' + url.format(this.uri)));
                return;
            }
            const messageReader = new rpcUtils_1.WrappedMessageReader(new rpc.StreamMessageReader(this.socket), (msg) => RPCClient.filterMessage(msg, this.rpcReadFilters));
            const messageWriter = new rpcUtils_1.WrappedMessageWriter(new rpc.StreamMessageWriter(this.socket), (msg) => RPCClient.filterMessage(msg, this.rpcWriteFilters));
            this.connection = rpc.createMessageConnection(messageReader, messageWriter, this);
            this.socket.on('connect', () => {
                didSucceed = true;
                this.trace.info('Agent connection success - ' + url.format(this.uri));
                startEvent.end(telemetry_1.TelemetryResult.Success, 'Agent connection success.');
                resolve();
            });
            this.connection.onError((error) => {
                const e = error[0];
                if (retryCount > 0) {
                    this.connection.dispose();
                    this.socket.destroy();
                    this.trace.verbose('Agent connection not completed: ' + e + '; Retrying...');
                    // Recursive call
                    setTimeout(() => {
                        this.init(--retryCount, retryInterval)
                            .then(() => resolve())
                            .catch(reject);
                    }, currentRetryInterval);
                }
                else {
                    if (!didSucceed) {
                        startEvent.end(telemetry_1.TelemetryResult.Failure, 'Agent connection failed. ' + e);
                    }
                    // No more retries. Dispose with the error from the last connection attempt.
                    this.dispose(e);
                    this.trace.error('Agent connection failed: ' + e);
                    reject(e);
                }
            });
            this.connection.onClose(() => {
                this.trace.info('RPC connection closed.');
                if (!this.disposed) {
                    // The connection was closed unexpectedly (not due to extension deactivation).
                    // Dispose with an error that causes further communication attemps to be
                    // rejected with an appropriate exception.
                    this.dispose(new serviceErrors_1.RpcConnectionClosedError());
                }
            });
            // add generic request support
            this.connection.onRequest((method, ...params) => {
                if (!this.starRequests.hasOwnProperty(method)) {
                    return Promise.resolve(new rpc.ResponseError(rpc.ErrorCodes.MethodNotFound, `method:${method} not supported`));
                }
                return this.starRequests[method](...params);
            });
            // Add progress and generic notification support.
            this.connection.onNotification((method, ...params) => {
                if (method === '$/progress' && typeof (params[0]) === 'object') {
                    const progressArgs = params[0];
                    const progress = this.progressHandlers.get(progressArgs.id);
                    if (progress) {
                        progress.report(progressArgs.value);
                    }
                }
                else if (this.starNotifications.has(method)) {
                    this.starNotifications.get(method).forEach(item => {
                        item.notificationHandler(...params);
                    });
                }
            });
            this.connection.listen();
        });
    }
    async ensureConnectionAsync() {
        if (!!this.initPromise) {
            // some other async caller is already connecting
            await this.initPromise;
        }
        if (!this.connection) {
            // the caller is connecting
            this.initPromise = this.init();
            await this.initPromise;
        }
        // connected
        return this.connection;
    }
    async onConnect(handler) {
        await this.ensureConnectionAsync();
        handler();
    }
    async onClose(handler) {
        await this.ensureConnectionAsync();
        this.connection.onClose(handler);
    }
    error(message) {
        this.trace.error(message);
    }
    warn(message) {
        this.trace.warning(message);
    }
    info(message) {
        this.trace.info(message);
    }
    log(message) {
        this.trace.verbose(message);
    }
    async sendRequest(trace, serviceAndMethodName, progress, cancellationToken, ...args) {
        const cancellationMessage = 'The request was cancelled.';
        const connection = await Promise.race([
            this.ensureConnectionAsync(),
            new Promise((resolve, reject) => {
                if (cancellationToken) {
                    if (cancellationToken.isCancellationRequested) {
                        return reject(new util_1.CancellationError(cancellationMessage));
                    }
                    cancellationToken.onCancellationRequested(() => {
                        reject(new util_1.CancellationError(cancellationMessage));
                    });
                }
            })
        ]);
        let argsString = '';
        if (traceSource_1.TraceFormat.disableObfuscation) {
            // Arguments may contain sensitive data, so only trace when obfuscation is disabled.
            argsString = JSON.stringify(args);
            argsString = argsString.substr(1, argsString.length - 2);
        }
        trace.verbose(`< ${serviceAndMethodName}(${argsString})`);
        let result;
        try {
            if (progress) {
                // Attach the progress handler to the args; the write filter will detect and register it.
                // Also attach the cancellation token so progress notifications can be cancelled.
                progress.cancellation = cancellationToken;
                args.progress = progress;
            }
            // The vscode-jsonrpc sendRequest() method can only detect a cancellation token argument
            // if it is not null.
            let sendPromise;
            if (cancellationToken) {
                sendPromise = connection.sendRequest(serviceAndMethodName, args, cancellationToken);
            }
            else {
                sendPromise = connection.sendRequest(serviceAndMethodName, args);
            }
            result = await sendPromise;
        }
        catch (err) {
            if (this.disposed) {
                // This will either block (during deactivation) or throw a connection-closed error.
                await this.initPromise;
            }
            // The error 'data' property should be the remote stack trace.
            // If it's not present just report the local stack trace.
            let errorMessage = err.data || err.stack;
            trace.error(`> ${serviceAndMethodName}() error: ` + errorMessage);
            throw err;
        }
        // Result may contain sensitive data, so only trace when obfuscation is disabled.
        if (traceSource_1.TraceFormat.disableObfuscation) {
            trace.verbose(`> ${serviceAndMethodName}() => ${JSON.stringify(result)}`);
        }
        else {
            trace.verbose(`> ${serviceAndMethodName}() succeeded`);
        }
        return result;
    }
    async sendNotification(trace, serviceAndName, eventArgs) {
        const connection = await this.ensureConnectionAsync();
        // Event args may contain sensitive data, so only trace when obfuscation is disabled.
        const argsString = traceSource_1.TraceFormat.disableObfuscation ? JSON.stringify(eventArgs) : '';
        trace.verbose(`sendNotification-> ${serviceAndName}: ${argsString}`);
        connection.sendNotification(serviceAndName, eventArgs);
    }
    addRequestMethod(method, requestHandler) {
        this.starRequests[method] = (...args) => {
            // The request ID was inserted into the args by the read filter. (It's not used here.)
            args.splice(0, 1);
            return requestHandler(...args);
        };
    }
    addRequestMethodWithContext(method, requestHandler) {
        this.addRequestMethod(method, requestHandler);
        this.rpcRequestsWithContext.add(method);
    }
    addRequestMethodWithProgress(method, requestHandler) {
        this.starRequests[method] = (...args) => {
            // The request ID was inserted into the args by the read filter.
            const [requestId] = args.splice(0, 1);
            const progress = {
                report: (value) => {
                    this.connection.sendNotification('$/progress', { id: requestId, value });
                },
            };
            // Insert progress into args just before the last (cancellation) arg.
            args.splice(args.length - 1, 0, progress);
            return requestHandler(...args);
        };
    }
    removeRequestMethod(method) {
        delete this.starRequests[method];
    }
    addNotificationHandler(method, notificationHandler) {
        let entrys = this.starNotifications.get(method);
        if (!entrys) {
            entrys = [];
            this.starNotifications.set(method, entrys);
        }
        const entry = {
            cookie: ++this.starNotificationsCookies,
            notificationHandler: notificationHandler
        };
        entrys.push(entry);
        return entry.cookie;
    }
    removeNotificationHandler(method, cookie) {
        let entrys = this.starNotifications.get(method);
        if (entrys) {
            const indexEntry = entrys.findIndex(i => i.cookie === cookie);
            if (indexEntry !== -1) {
                return entrys.splice(indexEntry, 1)[0].notificationHandler;
            }
        }
        return undefined;
    }
    addReadFilter(filter) {
        this.rpcReadFilters.push(filter);
    }
    addWriteFilter(filter) {
        this.rpcWriteFilters.push(filter);
    }
    static filterMessage(msg, filters) {
        for (const filter of filters) {
            msg = filter(msg);
        }
        return msg;
    }
    addProgressFilters() {
        this.rpcReadFilters.push((msg) => {
            let msgObj = msg;
            const requestId = msgObj.id;
            if (typeof requestId !== 'undefined') {
                if (Array.isArray(msgObj.params)) {
                    // This is an incoming request message.
                    // Insert the request ID into the params in case it is needed for progress.
                    msgObj.params.splice(0, 0, requestId);
                }
                else if (typeof msgObj.result !== 'undefined' || typeof msgObj.error !== 'undefined') {
                    // This is an incoming response message.
                    // Unregister any progress handler for the response's request ID.
                    this.progressHandlers.delete(requestId);
                }
            }
            return msg;
        });
        this.rpcWriteFilters.push((msg) => {
            let msgObj = msg;
            const requestId = msgObj.id;
            const params = msgObj.params;
            if (typeof requestId !== 'undefined' &&
                params && params.progress &&
                typeof params.progress.report === 'function') {
                // An outgoing message has a progress handler attached to the params.
                // Register the progress handler for the request ID.
                this.progressHandlers.set(msgObj.id, msgObj.params.progress);
                // Unregister the progress handler when the request is cancelled.
                const cancellation = params.progress.cancellation;
                if (cancellation) {
                    cancellation.onCancellationRequested(() => {
                        this.progressHandlers.delete(requestId);
                    });
                }
                delete params.progress;
            }
            return msg;
        });
    }
}
exports.RPCClient = RPCClient;
/**
 * Base class for RPC service proxies. Traces all messages
 * and emits events for incoming notifications.
 */
class RpcProxy {
    constructor(client, serviceName, trace) {
        this.client = client;
        this.serviceName = serviceName;
        this.trace = trace;
    }
    /**
     * Creates a proxy for an RPC service.
     *
     * @param serviceInfo Information about the service contract
     * @param client RPC client
     * @param traceName Name used for tracing RPC calls
     */
    static create(serviceInfo, client, traceName) {
        if (!(serviceInfo && serviceInfo.name)) {
            throw new Error('Missing RPC service name.');
        }
        const proxy = new RpcProxy(client, serviceInfo.name, traceSource_1.traceSource.withName(traceName));
        for (let methodName of serviceInfo.methods) {
            const methodPropertyName = `${methodName}Async`;
            proxy[methodPropertyName] = function () {
                // Detect whether optional cancellation token was supplied, and if so strip from args.
                let args;
                let cancellationToken = arguments[arguments.length - 1];
                if (cancellationToken &&
                    typeof cancellationToken === 'object' &&
                    typeof cancellationToken.isCancellationRequested === 'boolean') {
                    args = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
                }
                else {
                    args = Array.prototype.slice.call(arguments, 0, arguments.length);
                    cancellationToken = null;
                }
                // Detect whether optional progress was supplied, and if so strip from args.
                let progress = args[args.length - 1];
                if (progress &&
                    typeof progress === 'object' &&
                    typeof progress.report === 'function') {
                    args.splice(args.length - 1, 1);
                }
                else {
                    progress = null;
                }
                const serviceAndMethodName = proxy.serviceName + '.' + methodName;
                return proxy.client.sendRequest(this.trace, serviceAndMethodName, progress, cancellationToken, ...args);
            };
        }
        for (let eventName of serviceInfo.events) {
            const emitter = new vscode_1.EventEmitter();
            const eventPropertyName = `on${eventName.substr(0, 1).toUpperCase()}${eventName.substr(1)}`;
            proxy[eventPropertyName] = emitter.event;
            const serviceAndEventName = proxy.serviceName + '.' + eventName;
            proxy.client.ensureConnectionAsync().then((connection) => {
                connection.onNotification(serviceAndEventName, (...args) => {
                    const eventArgs = args[0];
                    // Event args may contain sensitive data, so only trace when obfuscation is disabled.
                    const argsString = traceSource_1.TraceFormat.disableObfuscation ? JSON.stringify(eventArgs) : '';
                    proxy.trace.verbose(`> ${serviceAndEventName}: ${argsString}`);
                    emitter.fire(eventArgs);
                });
            }).catch((e) => {
                // Failed to get the connection. There will already be errors traced elsewhere
                // about the connection failure, so there's no need to trace anything more here.
            });
        }
        return proxy;
    }
    /**
     * Sends a notification (event) from this client to the service.
     *
     * (This is a static method because RPC contract interfaces do not define methods
     * for reverse notifications.)
     */
    static notifyAsync(proxy, eventName, args) {
        const rpcProxy = proxy;
        const serviceAndMethodName = rpcProxy.serviceName + '.' + eventName;
        return rpcProxy.client.sendNotification(rpcProxy.trace, serviceAndMethodName, args);
    }
}
exports.RpcProxy = RpcProxy;

//# sourceMappingURL=service.js.map
