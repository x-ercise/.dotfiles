//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const net = require("net");
const uuid = require("uuid");
const config = require("../config");
const util = require("../util");
const vsls = require("../contracts/VSLS");
const path = require("path");
const agent_1 = require("../agent");
const session_1 = require("../session");
const sessionTypes_1 = require("../sessionTypes");
const service_1 = require("../workspace/service");
const telemetry_1 = require("../telemetry/telemetry");
const telemetryStrings_1 = require("../telemetry/telemetryStrings");
const tt = require("./terminalTypes");
/**
 * Provider class responsible for creating shared terminals and corresponding workers.
 * Should be state-less.
 */
class TerminalProvider {
    constructor(terminalService, terminalCache, trace) {
        this.terminalService = terminalService;
        this.terminalCache = terminalCache;
        this.trace = trace.withName('TerminalProvider');
    }
    /**
     * Creates a new instance of a terminal window and starts sharing it with collaboration session participants.
     *
     * @param terminalInfo Definition of the shared terminal instance created by VSLS terminal service.
     * @param renderer Optional renderer.
     * @returns New instance of a terminal window.
     */
    async createTerminal(terminalInfo, renderer) {
        let terminalEntry = this.terminalCache.getById(terminalInfo.id);
        if (!!terminalEntry) {
            terminalEntry.terminal.show();
            return terminalEntry.terminal;
        }
        const name = terminalInfo.options.name;
        if (!renderer && vscode.window.createTerminalRenderer) {
            renderer = vscode.window.createTerminalRenderer(name);
        }
        let terminal;
        const eventRegistrations = [];
        if (renderer) {
            let resizeTimer = null;
            renderer.onDidChangeMaximumDimensions(d => {
                if (resizeTimer) {
                    clearTimeout(resizeTimer);
                }
                // When the window is resized, it fires lots of resize events.
                // The timeout is a way to react only to the last event and reduce the churn.
                // 100ms is totally arbitrary. It seems good enough to produce just one event
                // after the resizing is done, soon enough for user to perceive it immediate.
                resizeTimer = setTimeout(async () => {
                    clearTimeout(resizeTimer);
                    resizeTimer = null;
                    try {
                        await this.terminalService.resizeTerminalAsync(terminalInfo.id, d.columns, d.rows);
                    }
                    catch (e) {
                        this.trace.error(`Error resizing terminal ${e}`);
                    }
                }, 100);
            }, this, eventRegistrations);
            this.terminalService.onTerminalResized(e => {
                if (e.terminal.id === terminalInfo.id) {
                    renderer.dimensions = { columns: e.terminal.options.cols, rows: e.terminal.options.rows };
                }
            }, this, eventRegistrations);
            const terminalEndpointRpcClient = new service_1.RPCClient(Promise.resolve({
                protocol: 'net.pipe:',
                hostname: 'localhost',
                pathname: `/${terminalInfo.localPipeName}`,
            }));
            terminalEndpointRpcClient.connectionOwner = 'shared-terminal';
            const terminalEndpoint = service_1.RpcProxy.create(vsls.TerminalEndpoint, terminalEndpointRpcClient, vsls.TraceSources.ClientRpcTerminalEndpoint);
            terminal = await renderer.terminal;
            this.pipeTerminalStdio(terminalEndpoint, renderer, this.trace);
        }
        else {
            const terminalOptions = {
                name,
                shellPath: agent_1.Agent.getAgentPath(),
                shellArgs: ['run-terminal', terminalInfo.localPipeName, '--integrated'],
            };
            terminalOptions.cwd = path.dirname(agent_1.Agent.getAgentPath());
            terminal = vscode.window.createTerminal(terminalOptions);
        }
        terminal.show();
        const disposeTerminalWorker = async () => {
            eventRegistrations.forEach(r => r.dispose());
            if (session_1.SessionContext.State === sessionTypes_1.SessionState.Shared) {
                await this.terminalService.stopTerminalAsync(terminalInfo.id);
            }
            else if (renderer) {
                try {
                    await this.terminalService.resizeTerminalAsync(terminalInfo.id, 0, 0);
                }
                catch (_a) {
                    // Backward compat: old host may not understand resizing to 0 dimensions.
                }
            }
        };
        terminalEntry = this.terminalCache.register(terminal, terminalInfo.id, true /* own */, {
            dispose: disposeTerminalWorker,
            scope: tt.WorkerScope.session
        });
        this.terminalService.onTerminalStopped((e) => {
            if (e.terminal.id === terminalInfo.id) {
                terminal.dispose();
            }
        }, null /* this */, eventRegistrations);
        return terminal;
    }
    async pipeTerminalStdio(endpoint, renderer, trace) {
        let disposables = [];
        const cts = new vscode.CancellationTokenSource();
        try {
            let writeTask = Promise.resolve();
            renderer.onDidAcceptInput(s => writeTask = writeTask.then(() => writeToEndpoint(s)), this, disposables);
            const terminal = await renderer.terminal;
            vscode.window.onDidCloseTerminal(t => { if (t === terminal) {
                cts.cancel();
            } }, this, disposables);
            function writeToEndpoint(s) {
                if (!cts.token.isCancellationRequested) {
                    return endpoint.writeStringAsync(s, cts.token);
                }
            }
            while (!cts.token.isCancellationRequested) {
                const text = await endpoint.readStringAsync(cts.token);
                if (text === null) {
                    break;
                }
                renderer.write(text);
            }
            cts.cancel();
            await writeTask;
        }
        catch (e) {
            if (!cts.token.isCancellationRequested && !endpoint.client.isDisposed) {
                trace.error(`Error running shared terminal renderer ${e}`);
                renderer.write(`\r\n\x1b[31mError running shared terminal ${e}\x1b[0m`);
                telemetry_1.Instance.sendFault(telemetryStrings_1.TelemetryEventNames.RUN_SHARED_TERMINAL_FAULT, telemetry_1.FaultType.Error, null, e);
            }
        }
        finally {
            disposables.forEach(value => value.dispose());
        }
    }
    /**
     * Shares an existing terminal window by starting a terminal worker that synchronizes i/o data streams
     * with collaboration session participants.
     *
     * @param terminal Existing terminal window.
     */
    async shareTerminal(terminal) {
        const terminalEntry = this.terminalCache.get(terminal);
        const prompt = terminalEntry ? terminalEntry.get(tt.MetadataKey.prompt) : null;
        const dataPipeName = uuid().replace(/-/g, '');
        const dimensions = {
            columns: config.get(config.Key.sharedTerminalWidth),
            rows: config.get(config.Key.sharedTerminalWidth)
        };
        const options = {
            name: (terminal.name || 'terminal') + ' [Shared]',
            dataPipeName: dataPipeName,
            rows: dimensions.rows,
            cols: dimensions.columns,
            readOnlyForGuests: true,
        };
        let terminalInfo = null;
        let dataServer = null;
        let registrations = [];
        let writeDataQueue = Promise.resolve();
        try {
            dataServer = net.createServer((socket) => {
                terminal.onDidWriteData(s => writeDataQueue = writeDataQueue.then(async () => {
                    await socket.write(s);
                }), null /* this */, registrations);
                socket.on('data', (data) => {
                    terminal.sendText(data.toString(), false /* addNewLine */);
                });
                socket.on('error', (err) => {
                    this.trace.error(err.message);
                });
                if (prompt) {
                    socket.write(prompt);
                }
            }).listen(util.getPipePath(dataPipeName));
            terminalInfo = await this.terminalService.startTerminalAsync(options);
        }
        catch (e) {
            this.trace.error(`Error running a shared terminal worker. ${e}`);
            telemetry_1.Instance.sendFault(telemetryStrings_1.TelemetryEventNames.RUN_SHARED_TERMINAL_FAULT, telemetry_1.FaultType.Error, null, e);
            if (dataServer) {
                dataServer.close();
            }
            return;
        }
        this.terminalService.onTerminalStopped((e) => {
            if (e.terminal.id === terminalInfo.id) {
                disposeTerminalWorker();
            }
        }, null /* this */, registrations);
        const disposeTerminalWorker = async (shouldStopTerminal) => {
            registrations.forEach(d => d.dispose());
            try {
                if (shouldStopTerminal &&
                    !this.terminalService.client.isDisposed) {
                    await this.terminalService.stopTerminalAsync(terminalInfo.id);
                }
            }
            catch (_a) { }
            try {
                dataServer.close();
            }
            catch (_b) { }
        };
        this.terminalCache.register(terminal, terminalInfo.id, false /* own */, {
            dispose: () => disposeTerminalWorker(true /* shouldStopTerminal */),
            scope: tt.WorkerScope.session,
        });
        telemetry_1.Instance.sendTelemetryEvent(telemetryStrings_1.TelemetryEventNames.START_SHARED_TERMINAL, {
            [telemetryStrings_1.TelemetryPropertyNames.SHARED_TERMINAL_READONLY]: false.toString(),
        });
    }
}
exports.TerminalProvider = TerminalProvider;

//# sourceMappingURL=terminalProvider.js.map
