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
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const req = require("request");
const CommandRunResult_1 = require("./structs/CommandRunResult");
class LogPointsDebuggerClientBase {
    makeCallAndLogException(siteName, affinityValue, publishCredential, command) {
        return this.call(siteName, affinityValue, publishCredential, command)
            .catch((err) => {
            throw err;
        });
    }
}
class KuduLogPointsDebuggerClient extends LogPointsDebuggerClientBase {
    static getBaseUri(siteName) {
        return `https://${siteName}.scm.azurewebsites.net`;
    }
    static getAuth(publishCredential) {
        return {
            user: publishCredential.publishingUserName,
            pass: publishCredential.publishingPassword,
            sendImmediately: true
        };
    }
    static base64Encode(payload) {
        if (typeof payload !== 'string') {
            payload = JSON.stringify(payload);
        }
        const buf = Buffer.from(payload, 'utf8');
        return buf.toString('base64');
    }
    startSession(siteName, affinityValue, publishCredential, data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.uploadSshClient(siteName, affinityValue, publishCredential);
            const jsonPayloadBase64 = KuduLogPointsDebuggerClient.base64Encode({
                username: data.username
            });
            return this.makeCallAndLogException(siteName, affinityValue, publishCredential, `curl -s -S -X POST -H "Content-Type: application/base64" -d ${jsonPayloadBase64} http://localhost:32923/debugger/session`);
        });
    }
    closeSession(siteName, affinityValue, publishCredential, data) {
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, `curl -s -S -X DELETE http://localhost:32923/debugger/session/${data.sessionId}`);
    }
    enumerateProcesses(siteName, affinityValue, publishCredential) {
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, "curl -s -S -X GET http://localhost:32923/os/processes?applicationType=Node.js");
    }
    attachProcess(siteName, affinityValue, publishCredential, data) {
        const jsonPayloadBase64 = KuduLogPointsDebuggerClient.base64Encode({
            processId: data.processId,
            codeType: "javascript"
        });
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, `curl -s -S -X POST -H "Content-Type: application/base64" -d ${jsonPayloadBase64} http://localhost:32923/debugger/session/${data.sessionId}/debugee`);
    }
    loadedScripts(siteName, affinityValue, publishCredential, data) {
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, `curl -s -S -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/sources`);
    }
    loadSource(siteName, affinityValue, publishCredential, data) {
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, `curl -s -S -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/source/${data.sourceId}`);
    }
    setLogpoint(siteName, affinityValue, publishCredential, data) {
        const jsonPayloadBase64 = KuduLogPointsDebuggerClient.base64Encode({
            sourceId: data.sourceId,
            zeroBasedColumnNumber: data.columNumber,
            zeroBasedLineNumber: data.lineNumber,
            expressionToLog: data.expression
        });
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, `curl -s -S -X POST -H "Content-Type: application/base64" -d ${jsonPayloadBase64} http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/logpoints`);
    }
    removeLogpoint(siteName, affinityValue, publishCredential, data) {
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, `curl -s -S -X DELETE -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/logpoints/${data.logpointId}`);
    }
    getLogpoints(siteName, affinityValue, publishCredential, data) {
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, `curl -s -S -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/logpoints?sourceId=${data.sourceId}`);
    }
    call(siteName, affinityValue, publishCredential, command) {
        const encodedCommand = KuduLogPointsDebuggerClient.base64Encode(command);
        const opts = {
            uri: `${KuduLogPointsDebuggerClient.getBaseUri(siteName)}/api/command`,
            auth: KuduLogPointsDebuggerClient.getAuth(publishCredential),
            json: true,
            body: {
                command: `/usr/bin/node ./ssh-client.js --command ${encodedCommand}`,
                dir: 'logpoints/ssh-client'
            }
        };
        const request = req.defaults({});
        request.cookie(`ARRAffinity=${affinityValue}`);
        return new Promise((resolve, reject) => {
            request.post(opts, (err, httpResponse, body) => {
                this.log(`sendCommand(): response is ${httpResponse.statusCode}`);
                if (err) {
                    this.log(`sendCommand(): received error: ${err}`);
                    reject(err);
                }
                else if (httpResponse.statusCode === 200) {
                    this.log(`sendCommand():  body is ${body}`);
                    resolve(new CommandRunResult_1.CommandRunResult(body.Error, body.ExitCode, body.Output));
                }
                else {
                    reject(`${httpResponse.statusCode} - ${httpResponse.statusMessage}`);
                }
            });
        });
    }
    log(message) {
        // tslint:disable-next-line:no-unused-expression
        message && 1;
    }
    uploadSshClient(siteName, affinityValue, publishCredential) {
        return __awaiter(this, void 0, void 0, function* () {
            const request = req.defaults({});
            request.cookie(`ARRAffinity=${affinityValue}`);
            const opts = {
                uri: `${KuduLogPointsDebuggerClient.getBaseUri(siteName)}/api/zip/logpoints/ssh-client/`,
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                auth: KuduLogPointsDebuggerClient.getAuth(publishCredential),
                body: fs.createReadStream(path.join(__dirname, '../../../resources/ssh-client.zip'))
            };
            return new Promise((resolve, reject) => {
                // tslint:disable-next-line:no-single-line-block-comment
                request.put(opts, (err, httpResponse /*, body */) => {
                    if (err) {
                        this.log(`placeSshClient(): Error placing ssh-client: ${err}`);
                        reject(err);
                    }
                    else {
                        this.log(`placeSshClient(): received ${httpResponse.statusCode}`);
                        resolve();
                    }
                });
            });
        });
    }
}
exports.KuduLogPointsDebuggerClient = KuduLogPointsDebuggerClient;
class MockLogpointsDebuggerClient extends LogPointsDebuggerClientBase {
    static base64Encode(payload) {
        if (typeof payload !== 'string') {
            payload = JSON.stringify(payload);
        }
        const buf = Buffer.from(payload, 'utf8');
        return buf.toString('base64');
    }
    startSession(siteName, affinityValue, publishCredential, data) {
        const jsonPayloadBase64 = MockLogpointsDebuggerClient.base64Encode({
            username: data.username
        });
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, `curl -s -S -X POST -H "Content-Type: application/base64" -d ${jsonPayloadBase64} http://localhost:32923/debugger/session`);
    }
    closeSession(siteName, affinityValue, publishCredential, data) {
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, `curl -s -S -X DELETE http://localhost:32923/debugger/session/${data.sessionId}`);
    }
    enumerateProcesses(siteName, affinityValue, publishCredential) {
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, "curl -s -S -X GET http://localhost:32923/os/processes?applicationType=Node.js");
    }
    attachProcess(siteName, affinityValue, publishCredential, data) {
        const jsonPayloadBase64 = MockLogpointsDebuggerClient.base64Encode({
            processId: data.processId,
            codeType: "javascript"
        });
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, `curl -s -S -X POST -H "Content-Type: application/base64" -d ${jsonPayloadBase64} http://localhost:32923/debugger/session/${data.sessionId}/debugee`);
    }
    loadedScripts(siteName, affinityValue, publishCredential, data) {
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, `curl -s -S -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/sources`);
    }
    loadSource(siteName, affinityValue, publishCredential, data) {
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, `curl -s -S -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/source/${data.sourceId}`);
    }
    setLogpoint(siteName, affinityValue, publishCredential, data) {
        const jsonPayloadBase64 = MockLogpointsDebuggerClient.base64Encode({
            sourceId: data.sourceId,
            zeroBasedColumnNumber: data.columNumber,
            zeroBasedLineNumber: data.lineNumber,
            expressionToLog: data.expression
        });
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, `curl -s -S -X POST -H "Content-Type: application/base64" -d '${jsonPayloadBase64}' http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/logpoints`);
    }
    removeLogpoint(siteName, affinityValue, publishCredential, data) {
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, `curl -s -S -X DELETE -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/logpoints/${data.logpointId}`);
    }
    getLogpoints(siteName, affinityValue, publishCredential, data) {
        return this.makeCallAndLogException(siteName, affinityValue, publishCredential, `curl -s -S -X GET -H "Content-Type: application/json" http://localhost:32923/debugger/session/${data.sessionId}/debugee/${data.debugId}/logpoints?sourceId=${data.sourceId}`);
    }
    call(siteName, affinityValue, publishCredential, command) {
        // tslint:disable-next-line:no-unused-expression
        siteName && affinityValue && publishCredential;
        return new Promise((resolve) => {
            // tslint:disable-next-line:no-any
            child_process.exec(command, (error, stdout, stderr) => {
                if (error) {
                    resolve(new CommandRunResult_1.CommandRunResult(error, error.code, stderr));
                    return;
                }
                const output = JSON.stringify({ exitCode: 0, stdout, stderr });
                resolve(new CommandRunResult_1.CommandRunResult(undefined, 0, output));
            });
        });
    }
}
exports.MockLogpointsDebuggerClient = MockLogpointsDebuggerClient;
const shouldUseMockKuduCall = false;
function createDefaultClient() {
    if (shouldUseMockKuduCall) {
        return new MockLogpointsDebuggerClient();
    }
    else {
        return new KuduLogPointsDebuggerClient();
    }
}
exports.createDefaultClient = createDefaultClient;
//# sourceMappingURL=logPointsClient.js.map