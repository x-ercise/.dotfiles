"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const EventEmitter = require("events");
const net_1 = require("net");
const vscode_azureappservice_1 = require("vscode-azureappservice");
const websocket = require("websocket");
class DebugProxy extends EventEmitter {
    constructor(outputChannel, client, port, publishCredential) {
        super();
        this._client = client;
        this._port = port;
        this._publishCredential = publishCredential;
        this._keepAlive = true;
        this._outputChannel = outputChannel;
        this._server = net_1.createServer();
    }
    startProxy() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._server) {
                this.emit('error', new Error('Proxy server is not started.'));
            }
            else {
                // wake up the function app before connecting to it.
                yield this.keepAlive();
                this._server.on('connection', (socket) => {
                    if (this._wsclient) {
                        this._outputChannel.appendLine(`[Proxy Server] The server is already connected to "${this._wsclient.url.hostname}". Rejected connection to "${socket.remoteAddress}:${socket.remotePort}"`);
                        this.emit('error', new Error(`[Proxy Server]  The server is already connected to "${this._wsclient.url.hostname}". Rejected connection to "${socket.remoteAddress}:${socket.remotePort}"`));
                        socket.destroy();
                    }
                    else {
                        this._outputChannel.appendLine(`[Proxy Server] client connected ${socket.remoteAddress}:${socket.remotePort}`);
                        socket.pause();
                        this._wsclient = new websocket.client();
                        this._wsclient.on('connect', (connection) => {
                            this._outputChannel.appendLine('[WebSocket] client connected');
                            this._wsconnection = connection;
                            connection.on('close', () => {
                                this._outputChannel.appendLine('[WebSocket] client closed');
                                this.dispose();
                                socket.destroy();
                                this.emit('end');
                            });
                            connection.on('error', (err) => {
                                this._outputChannel.appendLine(`[WebSocket] ${err}`);
                                this.dispose();
                                socket.destroy();
                                this.emit('error', err);
                            });
                            connection.on('message', (data) => {
                                socket.write(data.binaryData);
                            });
                            socket.resume();
                        });
                        this._wsclient.on('connectFailed', (err) => {
                            this._outputChannel.appendLine(`[WebSocket] ${err}`);
                            this.dispose();
                            socket.destroy();
                            this.emit('error', err);
                        });
                        this._wsclient.connect(`wss://${this._client.kuduHostName}/DebugSiteExtension/JavaDebugSiteExtension.ashx`, undefined, undefined, { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }, { auth: `${this._publishCredential.publishingUserName}:${this._publishCredential.publishingPassword}` });
                        socket.on('data', (data) => {
                            if (this._wsconnection) {
                                this._wsconnection.send(data);
                            }
                        });
                        socket.on('end', () => {
                            this._outputChannel.appendLine(`[Proxy Server] client disconnected ${socket.remoteAddress}:${socket.remotePort}`);
                            this.dispose();
                            this.emit('end');
                        });
                        socket.on('error', (err) => {
                            this._outputChannel.appendLine(`[Proxy Server] ${err}`);
                            this.dispose();
                            socket.destroy();
                            this.emit('error', err);
                        });
                    }
                });
                this._server.on('listening', () => {
                    this._outputChannel.appendLine('[Proxy Server] start listening');
                    this.emit('start');
                });
                this._server.listen({
                    host: 'localhost',
                    port: this._port,
                    backlog: 1
                });
            }
        });
    }
    dispose() {
        if (this._wsconnection) {
            this._wsconnection.close();
            this._wsconnection = undefined;
        }
        if (this._wsclient) {
            this._wsclient.abort();
            this._wsclient = undefined;
        }
        if (this._server) {
            this._server.close();
            this._server = undefined;
        }
        this._keepAlive = false;
    }
    //keep querying the function app state, otherwise the connection will lose.
    keepAlive() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._keepAlive) {
                try {
                    yield vscode_azureappservice_1.pingFunctionApp(this._client);
                    setTimeout(this.keepAlive, 60 * 1000 /* 60 seconds */);
                }
                catch (err) {
                    this._outputChannel.appendLine(`[Proxy Server] ${err}`);
                    setTimeout(this.keepAlive, 5 * 1000 /* 5 seconds */);
                }
            }
        });
    }
}
exports.DebugProxy = DebugProxy;
//# sourceMappingURL=DebugProxy.js.map