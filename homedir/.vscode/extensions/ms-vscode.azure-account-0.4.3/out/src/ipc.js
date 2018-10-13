/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const http = require("http");
const os = require("os");
const crypto = require("crypto");
function createServer(ipcHandlePrefix, onRequest) {
    return __awaiter(this, void 0, void 0, function* () {
        const buffer = yield randomBytes(20);
        const nonce = buffer.toString('hex');
        const ipcHandlePath = getIPCHandlePath(`${ipcHandlePrefix}-${nonce}`);
        const server = new Server(ipcHandlePath, onRequest);
        server.listen();
        return server;
    });
}
exports.createServer = createServer;
class Server {
    constructor(ipcHandlePath, onRequest) {
        this.ipcHandlePath = ipcHandlePath;
        this.server = http.createServer((req, res) => {
            Promise.resolve(onRequest(req, res))
                .catch((err) => console.error(err && err.message || err));
        });
        this.server.on('error', err => console.error(err));
    }
    listen() {
        this.server.listen(this.ipcHandlePath);
    }
    dispose() {
        this.server.close();
    }
}
exports.Server = Server;
function readJSON(req) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const chunks = [];
            req.setEncoding('utf8');
            req.on('data', (d) => chunks.push(d));
            req.on('error', (err) => reject(err));
            req.on('end', () => {
                const data = JSON.parse(chunks.join(''));
                resolve(data);
            });
        });
    });
}
exports.readJSON = readJSON;
function sendData(socketPath, data) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const opts = {
                socketPath,
                path: '/',
                method: 'POST'
            };
            const req = http.request(opts, res => resolve(res));
            req.on('error', (err) => reject(err));
            req.write(data);
            req.end();
        });
    });
}
exports.sendData = sendData;
function randomBytes(size) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(size, (err, buf) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(buf);
                }
            });
        });
    });
}
function getIPCHandlePath(id) {
    if (process.platform === 'win32') {
        return `\\\\.\\pipe\\${id}-sock`;
    }
    if (process.env['XDG_RUNTIME_DIR']) {
        return path.join(process.env['XDG_RUNTIME_DIR'], `${id}.sock`);
    }
    return path.join(os.tmpdir(), `${id}.sock`);
}
class Queue {
    constructor() {
        this.messages = [];
    }
    push(message) {
        this.messages.push(message);
        if (this.dequeueRequest) {
            this.dequeueRequest.resolve(this.messages);
            this.dequeueRequest = undefined;
            this.messages = [];
        }
    }
    dequeue(timeout) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.messages.length) {
                const messages = this.messages;
                this.messages = [];
                return messages;
            }
            if (this.dequeueRequest) {
                this.dequeueRequest.resolve([]);
            }
            return new Promise((resolve, reject) => {
                this.dequeueRequest = { resolve, reject };
                if (typeof timeout === 'number') {
                    setTimeout(reject, timeout);
                }
            });
        });
    }
}
exports.Queue = Queue;
//# sourceMappingURL=ipc.js.map