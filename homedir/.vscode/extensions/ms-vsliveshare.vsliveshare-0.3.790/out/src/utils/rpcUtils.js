"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class WrappedMessageReader {
    constructor(messageReader, messageTransformer) {
        this.messageReader = messageReader;
        this.messageTransformer = messageTransformer;
        this.onError = this.messageReader.onError;
        this.onClose = this.messageReader.onClose;
        this.onPartialMessage = this.messageReader.onPartialMessage;
    }
    listen(callback) {
        const wrappedCallback = (msg) => {
            callback(this.messageTransformer(msg));
        };
        this.messageReader.listen(wrappedCallback);
    }
    dispose() {
        this.messageReader.dispose();
    }
}
exports.WrappedMessageReader = WrappedMessageReader;
class WrappedMessageWriter {
    constructor(messageWriter, messageTransformer) {
        this.messageWriter = messageWriter;
        this.messageTransformer = messageTransformer;
        this.onError = this.messageWriter.onError;
        this.onClose = this.messageWriter.onClose;
    }
    write(msg) {
        this.messageWriter.write(this.messageTransformer(msg));
    }
    dispose() {
        this.messageWriter.dispose();
    }
}
exports.WrappedMessageWriter = WrappedMessageWriter;
class TimingFilter {
    constructor() {
        // Map from message ids to when the message was received/sent
        this.times = new Map();
    }
    filter(isWrite, msg) {
        if (typeof msg.id !== 'number') {
            return msg;
        }
        if (this.times.has(msg.id)) {
            const duration = Date.now() - this.times.get(msg.id);
            this.times.delete(msg.id);
            // If one of the RPC clients doesn't include timing information (e.g. they are an older version),
            // none of them should to avoid misleading data.
            if (isWrite || (typeof msg.times !== 'undefined')) {
                msg.times = TimedRpcMessageUtils.addTime(msg.times, duration);
            }
        }
        else {
            this.times.set(msg.id, Date.now());
        }
        return msg;
    }
}
exports.TimingFilter = TimingFilter;
/*
The "times" property on an RPC message is an
array of times in milliseconds taken to send/receive/respond to requests
Includes times from sending requests to receiving responses and
time from receiving requests to returning responses.

E.g. a simple scenario where A makes a request to B:
A sends a request to B and begins timing.
B receives the request and begins timing.
B processes the request.
B is ready to resolve the request, so stops timing, stamps
the time it took to respond on the response message, and sends the reponse.
A receives the response, stops timing, subtracts off the time taken for B to respond (this time is
included in the response message) and adds another item to the list of handling times on the response message.
The first time in the list of handling times is the amount of time it took B to process the request,
and the second time in the list is the communication latency between A and B.

In more complicated scenarios where requests go through multiple clients,
the list of handling times can be used to find the communication latency between
each RPC client in the chain, and how long processing took at each client.

In general, the last client in the chain will only contribute one time to the list:
the amount of time it took to respond to the request. So this is always
the first item in the list. Similarly, the first client in the chain (the one that made the initial request)
only contributes one time to the list: the communication latency between itself and the
first client in the chain. So this is always the last item in the list. Intermediate clients contribute 2 times each:
the first is the communication latency between the client and the next in the chain. The second is the time
it took the client to do any intermediate processing before forwarding the request on to the next client and
returning the response to the previous client.

E.g. if times = [a, b, c, d], there were three clients involved in the request. a is the time it took
the last client to handle the request, b is the communication latency between the second and third client,
c is the time it took the second client from receiving the request from the first client to forward the request
to the third client plus the time from receiving the response from the third client to sending it to the first client,
and d is the communication latency between the first and second client. The full time from the first client
making the request to receiving the response is a + b + c + d. In general, the latency of the request is the sum of
every other item in the list, starting at index 1 (here b + d), and the processing time is the sum of every other item
in the list, starting at index 0 (here a + c).
*/
class TimedRpcMessageUtils {
    static addTime(times, time) {
        if (typeof times === 'undefined') {
            times = [];
        }
        const timeToAdd = time - TimedRpcMessageUtils.getTotalTime(times);
        times.push(timeToAdd > 0 ? timeToAdd : 0);
        return times;
    }
    // The latency is the sum of every other item in the list of times, starting at index 1.
    // See comment above this class for detailed explanation.
    static getLatency(times) {
        let latency = 0;
        if (times) {
            for (let i = 1; i < times.length; i += 2) {
                latency += times[i];
            }
        }
        return latency;
    }
    // The processing time is the sum of every other item in the list of times, starting at index 0.
    // See comment above this class for detailed explanation.
    static getProcessingTime(times) {
        let processingTime = 0;
        if (times) {
            for (let i = 0; i < times.length; i += 2) {
                processingTime += times[i];
            }
        }
        return processingTime;
    }
    static getTotalTime(times) {
        return TimedRpcMessageUtils.getLatency(times) + TimedRpcMessageUtils.getProcessingTime(times);
    }
}
exports.TimedRpcMessageUtils = TimedRpcMessageUtils;
/*
    RPC message filter that adds message context to the parameter object of RPC messages
*/
function AddContextToRpcMessage(msg) {
    if (!msg) {
        return msg;
    }
    const context = msg.context;
    const params = msg.params;
    if (typeof context !== 'object' || typeof params !== 'object' || Array.isArray(params) || params.context) {
        return msg;
    }
    return Object.assign({}, msg, { params: Object.assign({ context }, params) });
}
exports.AddContextToRpcMessage = AddContextToRpcMessage;
class RpcRequestsWithContext {
    constructor() {
        this.methods = new Set();
        this.readFilter = this.filterMessage.bind(this);
    }
    add(method) {
        if (method) {
            this.methods.add(method);
        }
    }
    filterMessage(msg) {
        const request = msg;
        if (!request.method || !this.methods.has(request.method)) {
            return msg;
        }
        const context = msg.context || {};
        if (!request.params) {
            request.params = [context];
        }
        else if (Array.isArray(request.params)) {
            request.params.push(context);
        }
        return request;
    }
}
exports.RpcRequestsWithContext = RpcRequestsWithContext;

//# sourceMappingURL=rpcUtils.js.map
