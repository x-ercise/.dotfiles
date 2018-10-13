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
const vscode_1 = require("vscode");
const azure_account_1 = require("./azure-account");
const ipc_1 = require("./ipc");
const cloudConsoleLauncher_1 = require("./cloudConsoleLauncher");
const nls = require("vscode-nls");
const path = require("path");
const opn = require("opn");
const cp = require("child_process");
const semver = require("semver");
const tenantDetailsClient_1 = require("./tenantDetailsClient");
const ms_rest_azure_1 = require("ms-rest-azure");
const FormData = require("form-data");
const url_1 = require("url");
// const adal = require('adal-node');
// function turnOnLogging() {
//   var log = adal.Logging;
//   log.setLoggingOptions(
//   {
//     level : log.LOGGING_LEVEL.VERBOSE,
//     log : function(level: number, message: string, error: any) {
//       console.log(message);
//       if (error) {
//         console.log(error);
//       }
//     }
//   });
// }
// turnOnLogging();
const localize = nls.loadMessageBundle();
exports.OSes = {
    Linux: {
        id: 'linux',
        shellName: localize('azure-account.bash', "Bash"),
        get otherOS() { return exports.OSes.Windows; },
    },
    Windows: {
        id: 'windows',
        shellName: localize('azure-account.powershell', "PowerShell"),
        get otherOS() { return exports.OSes.Linux; },
    }
};
function sendTelemetryEvent(reporter, outcome, message) {
    /* __GDPR__
       "openCloudConsole" : {
          "outcome" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
          "message": { "classification": "CallstackOrException", "purpose": "PerformanceAndHealth" }
       }
     */
    reporter.sendTelemetryEvent('openCloudConsole', message ? { outcome, message } : { outcome });
}
function waitForConnection() {
    return __awaiter(this, void 0, void 0, function* () {
        const handleStatus = () => {
            switch (this.status) {
                case 'Connecting':
                    return new Promise(resolve => {
                        const subs = this.onStatusChanged(() => {
                            subs.dispose();
                            resolve(handleStatus());
                        });
                    });
                case 'Connected':
                    return true;
                case 'Disconnected':
                    return false;
                default:
                    const status = this.status;
                    throw new Error(`Unexpected status '${status}'`);
            }
        };
        return handleStatus();
    });
}
function uploadFile(tokens, uris) {
    return function (filename, stream, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if (options.progress) {
                options.progress.report({ message: localize('azure-account.connectingForUpload', "Connecting to upload '{0}'...", filename) });
            }
            const accessTokens = yield tokens;
            const { terminalUri } = yield uris;
            if (options.token && options.token.isCancellationRequested) {
                throw 'canceled';
            }
            return new Promise((resolve, reject) => {
                const form = new FormData();
                form.append('uploading-file', stream, {
                    filename,
                    knownLength: options.contentLength
                });
                const uri = url_1.parse(`${terminalUri}/upload`);
                const req = form.submit({
                    protocol: uri.protocol,
                    hostname: uri.hostname,
                    port: uri.port,
                    path: uri.path,
                    headers: {
                        'Authorization': `Bearer ${accessTokens.resource}`
                    },
                }, (err, res) => {
                    if (err) {
                        reject(err);
                    }
                    if (res && res.statusCode && (res.statusCode < 200 || res.statusCode > 299)) {
                        reject(`${res.statusMessage} (${res.statusCode})`);
                    }
                    else {
                        resolve();
                    }
                    if (res) {
                        res.resume(); // Consume response.
                    }
                });
                if (options.token) {
                    options.token.onCancellationRequested(() => {
                        reject('canceled');
                        req.abort();
                    });
                }
                if (options.progress) {
                    req.on('socket', (socket) => {
                        options.progress.report({
                            message: localize('azure-account.uploading', "Uploading '{0}'...", filename),
                            increment: 0
                        });
                        let previous = 0;
                        socket.on('drain', () => {
                            const total = req.getHeader('Content-Length');
                            if (total) {
                                const worked = Math.min(Math.round(100 * socket.bytesWritten / total), 100);
                                const increment = worked - previous;
                                if (increment) {
                                    options.progress.report({
                                        message: localize('azure-account.uploading', "Uploading '{0}'...", filename),
                                        increment
                                    });
                                }
                                previous = worked;
                            }
                        });
                    });
                }
            });
        });
    };
}
exports.shells = [];
function createCloudConsole(api, reporter, osName) {
    const os = exports.OSes[osName];
    let liveQueue;
    const event = new vscode_1.EventEmitter();
    let deferredTerminal;
    let deferredSession;
    let deferredTokens;
    const tokensPromise = new Promise((resolve, reject) => deferredTokens = { resolve, reject });
    let deferredUris;
    const urisPromise = new Promise((resolve, reject) => deferredUris = { resolve, reject });
    let deferredInitialSize;
    const initialSizePromise = new Promise((resolve, reject) => deferredInitialSize = { resolve, reject });
    const state = {
        status: 'Connecting',
        onStatusChanged: event.event,
        waitForConnection,
        terminal: new Promise((resolve, reject) => deferredTerminal = { resolve, reject }),
        session: new Promise((resolve, reject) => deferredSession = { resolve, reject }),
        uploadFile: uploadFile(tokensPromise, urisPromise)
    };
    state.terminal.catch(() => { }); // ignore
    state.session.catch(() => { }); // ignore
    exports.shells.push(state);
    function updateStatus(status) {
        state.status = status;
        event.fire(state.status);
        if (status === 'Disconnected') {
            deferredTerminal.reject(status);
            deferredSession.reject(status);
            deferredTokens.reject(status);
            deferredUris.reject(status);
            exports.shells.splice(exports.shells.indexOf(state), 1);
            vscode_1.commands.executeCommand('setContext', 'openCloudConsoleCount', `${exports.shells.length}`);
        }
    }
    (function () {
        return __awaiter(this, void 0, void 0, function* () {
            vscode_1.commands.executeCommand('setContext', 'openCloudConsoleCount', `${exports.shells.length}`);
            const isWindows = process.platform === 'win32';
            if (isWindows) {
                // See below
                try {
                    const { stdout } = yield exec('node.exe --version');
                    const version = stdout[0] === 'v' && stdout.substr(1).trim();
                    if (version && semver.valid(version) && !semver.gte(version, '6.0.0')) {
                        updateStatus('Disconnected');
                        return requiresNode(reporter);
                    }
                }
                catch (err) {
                    updateStatus('Disconnected');
                    return requiresNode(reporter);
                }
            }
            // ipc
            const queue = new ipc_1.Queue();
            const ipc = yield ipc_1.createServer('vscode-cloud-console', (req, res) => __awaiter(this, void 0, void 0, function* () {
                let dequeue = false;
                for (const message of yield ipc_1.readJSON(req)) {
                    if (message.type === 'poll') {
                        dequeue = true;
                    }
                    else if (message.type === 'log') {
                        console.log(...message.args);
                    }
                    else if (message.type === 'size') {
                        deferredInitialSize.resolve(message.size);
                    }
                    else if (message.type === 'status') {
                        updateStatus(message.status);
                    }
                }
                let response = [];
                if (dequeue) {
                    try {
                        response = yield queue.dequeue(60000);
                    }
                    catch (err) {
                        // ignore timeout
                    }
                }
                res.write(JSON.stringify(response));
                res.end();
            }));
            // open terminal
            let shellPath = path.join(__dirname, `../../bin/node.${isWindows ? 'bat' : 'sh'}`);
            let modulePath = path.join(__dirname, 'cloudConsoleLauncher');
            if (isWindows) {
                modulePath = modulePath.replace(/\\/g, '\\\\');
            }
            const shellArgs = [
                process.argv0,
                '-e',
                `require('${modulePath}').main()`,
            ];
            if (isWindows) {
                // Work around https://github.com/electron/electron/issues/4218 https://github.com/nodejs/node/issues/11656
                shellPath = 'node.exe';
                shellArgs.shift();
            }
            const terminal = vscode_1.window.createTerminal({
                name: localize('azure-account.cloudConsole', "{0} in Cloud Shell", os.shellName),
                shellPath,
                shellArgs,
                env: {
                    CLOUD_CONSOLE_IPC: ipc.ipcHandlePath,
                }
            });
            const subscription = vscode_1.window.onDidCloseTerminal(t => {
                if (t === terminal) {
                    liveQueue = undefined;
                    subscription.dispose();
                    ipc.dispose();
                    updateStatus('Disconnected');
                }
            });
            liveQueue = queue;
            deferredTerminal.resolve(terminal);
            const loginStatus = yield waitForLoginStatus(api);
            if (loginStatus !== 'LoggedIn') {
                if (loginStatus === 'LoggingIn') {
                    queue.push({ type: 'log', args: [localize('azure-account.loggingIn', "Signing in...")] });
                }
                if (!(yield api.waitForLogin())) {
                    queue.push({ type: 'log', args: [localize('azure-account.loginNeeded', "Sign in needed.")] });
                    sendTelemetryEvent(reporter, 'requiresLogin');
                    yield vscode_1.commands.executeCommand('azure-account.askForLogin');
                    if (!(yield api.waitForLogin())) {
                        queue.push({ type: 'exit' });
                        updateStatus('Disconnected');
                        return;
                    }
                }
            }
            let token = undefined;
            yield api.waitForSubscriptions();
            const sessions = [...new Set(api.subscriptions.map(subscription => subscription.session))]; // Only consider those with at least one subscription.
            if (sessions.length > 1) {
                queue.push({ type: 'log', args: [localize('azure-account.selectDirectory', "Select directory...")] });
                const fetchingDetails = Promise.all(sessions.map(session => fetchTenantDetails(session)
                    .catch(err => {
                    console.error(err);
                    return undefined;
                })))
                    .then(tenantDetails => tenantDetails.filter(details => details));
                const pick = yield vscode_1.window.showQuickPick(fetchingDetails
                    .then(tenantDetails => tenantDetails.map(details => {
                    const tenantDetails = details.tenantDetails;
                    const defaultDomain = tenantDetails.verifiedDomains.find(domain => domain.default);
                    return {
                        label: tenantDetails.displayName,
                        description: defaultDomain && defaultDomain.name,
                        session: details.session
                    };
                }).sort((a, b) => a.label.localeCompare(b.label))), {
                    placeHolder: localize('azure-account.selectDirectoryPlaceholder', "Select directory"),
                    ignoreFocusOut: true // The terminal opens concurrently and can steal focus (#77).
                });
                if (!pick) {
                    sendTelemetryEvent(reporter, 'noTenantPicked');
                    queue.push({ type: 'exit' });
                    updateStatus('Disconnected');
                    return;
                }
                token = yield acquireToken(pick.session);
            }
            else if (sessions.length === 1) {
                token = yield acquireToken(sessions[0]);
            }
            const result = token && (yield findUserSettings(token));
            if (!result) {
                queue.push({ type: 'log', args: [localize('azure-account.setupNeeded', "Setup needed.")] });
                yield requiresSetUp(reporter);
                queue.push({ type: 'exit' });
                updateStatus('Disconnected');
                return;
            }
            deferredSession.resolve(result.token.session);
            // provision
            let consoleUri;
            const session = result.token.session;
            const accessToken = result.token.accessToken;
            const armEndpoint = session.environment.resourceManagerEndpointUrl;
            const provision = () => __awaiter(this, void 0, void 0, function* () {
                consoleUri = yield cloudConsoleLauncher_1.provisionConsole(accessToken, armEndpoint, result.userSettings, exports.OSes.Linux.id);
                sendTelemetryEvent(reporter, 'provisioned');
            });
            try {
                queue.push({ type: 'log', args: [localize('azure-account.requestingCloudConsole', "Requesting a Cloud Shell...")] });
                yield provision();
            }
            catch (err) {
                if (err && err.message === cloudConsoleLauncher_1.Errors.DeploymentOsTypeConflict) {
                    const reset = yield deploymentConflict(reporter, os);
                    if (reset) {
                        yield cloudConsoleLauncher_1.resetConsole(accessToken, armEndpoint);
                        return provision();
                    }
                    else {
                        queue.push({ type: 'exit' });
                        updateStatus('Disconnected');
                        return;
                    }
                }
                else {
                    throw err;
                }
            }
            // Additional tokens
            const [graphToken, keyVaultToken] = yield Promise.all([
                azure_account_1.tokenFromRefreshToken(session.environment, result.token.refreshToken, session.tenantId, session.environment.activeDirectoryGraphResourceId),
                azure_account_1.tokenFromRefreshToken(session.environment, result.token.refreshToken, session.tenantId, `https://${session.environment.keyVaultDnsSuffix.substr(1)}`)
            ]);
            const accessTokens = {
                resource: accessToken,
                graph: graphToken.accessToken,
                keyVault: keyVaultToken.accessToken
            };
            deferredTokens.resolve(accessTokens);
            // Connect to terminal
            const connecting = localize('azure-account.connectingTerminal', "Connecting terminal...");
            queue.push({ type: 'log', args: [connecting] });
            const progress = (i) => {
                queue.push({ type: 'log', args: [`\x1b[A${connecting}${'.'.repeat(i)}`] });
            };
            const initialSize = yield initialSizePromise;
            const consoleUris = yield cloudConsoleLauncher_1.connectTerminal(accessTokens, consoleUri, /* TODO: Separate Shell from OS */ osName === 'Linux' ? 'bash' : 'pwsh', initialSize, progress);
            deferredUris.resolve(consoleUris);
            // Connect to WebSocket
            queue.push({
                type: 'connect',
                accessTokens,
                consoleUris
            });
        });
    })().catch(err => {
        console.error(err && err.stack || err);
        updateStatus('Disconnected');
        sendTelemetryEvent(reporter, 'error', String(err && err.message || err));
        if (liveQueue) {
            liveQueue.push({ type: 'log', args: [localize('azure-account.error', "Error: {0}", String(err && err.message || err))] });
        }
    });
    return state;
}
exports.createCloudConsole = createCloudConsole;
function waitForLoginStatus(api) {
    return __awaiter(this, void 0, void 0, function* () {
        if (api.status !== 'Initializing') {
            return api.status;
        }
        return new Promise(resolve => {
            const subscription = api.onStatusChanged(() => {
                subscription.dispose();
                resolve(waitForLoginStatus(api));
            });
        });
    });
}
function findUserSettings(token) {
    return __awaiter(this, void 0, void 0, function* () {
        const userSettings = yield cloudConsoleLauncher_1.getUserSettings(token.accessToken, token.session.environment.resourceManagerEndpointUrl);
        if (userSettings && userSettings.storageProfile) {
            return { userSettings, token };
        }
    });
}
function requiresSetUp(reporter) {
    return __awaiter(this, void 0, void 0, function* () {
        sendTelemetryEvent(reporter, 'requiresSetUp');
        const open = { title: localize('azure-account.open', "Open") };
        const message = localize('azure-account.setUpInWeb', "First launch of Cloud Shell in a directory requires setup in the web application (https://shell.azure.com).");
        const response = yield vscode_1.window.showInformationMessage(message, open);
        if (response === open) {
            sendTelemetryEvent(reporter, 'requiresSetUpOpen');
            opn('https://shell.azure.com');
        }
        else {
            sendTelemetryEvent(reporter, 'requiresSetUpCancel');
        }
    });
}
function requiresNode(reporter) {
    return __awaiter(this, void 0, void 0, function* () {
        sendTelemetryEvent(reporter, 'requiresNode');
        const open = { title: localize('azure-account.open', "Open") };
        const message = localize('azure-account.requiresNode', "Opening a Cloud Shell currently requires Node.js 6 or later to be installed (https://nodejs.org).");
        const response = yield vscode_1.window.showInformationMessage(message, open);
        if (response === open) {
            sendTelemetryEvent(reporter, 'requiresNodeOpen');
            opn('https://nodejs.org');
        }
        else {
            sendTelemetryEvent(reporter, 'requiresNodeCancel');
        }
    });
}
function deploymentConflict(reporter, os) {
    return __awaiter(this, void 0, void 0, function* () {
        sendTelemetryEvent(reporter, 'deploymentConflict');
        const ok = { title: localize('azure-account.ok', "OK") };
        const message = localize('azure-account.deploymentConflict', "Starting a {0} session will terminate all active {1} sessions. Any running processes in active {1} sessions will be terminated.", os.shellName, os.otherOS.shellName);
        const response = yield vscode_1.window.showWarningMessage(message, ok);
        const reset = response === ok;
        sendTelemetryEvent(reporter, reset ? 'deploymentConflictReset' : 'deploymentConflictCancel');
        return reset;
    });
}
function acquireToken(session) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const credentials = session.credentials;
            const environment = session.environment;
            credentials.context.acquireToken(environment.activeDirectoryResourceId, credentials.username, credentials.clientId, function (err, result) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve({
                        session,
                        accessToken: result.accessToken,
                        refreshToken: result.refreshToken
                    });
                }
            });
        });
    });
}
function fetchTenantDetails(session) {
    return __awaiter(this, void 0, void 0, function* () {
        const { username, clientId, tokenCache, domain } = session.credentials;
        const graphCredentials = new ms_rest_azure_1.DeviceTokenCredentials({ username, clientId, tokenCache, domain, tokenAudience: 'graph' });
        const client = new tenantDetailsClient_1.TenantDetailsClient(graphCredentials, session.tenantId, session.environment.activeDirectoryGraphResourceId);
        return {
            session,
            tenantDetails: (yield client.details.get()).value[0]
        };
    });
}
function exec(command) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            cp.exec(command, (error, stdout, stderr) => {
                (error || stderr ? reject : resolve)({ error, stdout, stderr });
            });
        });
    });
}
//# sourceMappingURL=cloudConsole.js.map