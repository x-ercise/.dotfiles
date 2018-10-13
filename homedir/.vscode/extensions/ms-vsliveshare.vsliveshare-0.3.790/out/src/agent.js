//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const readline_1 = require("readline");
const fs = require("fs-extra");
const url = require("url");
const child_process = require("child_process");
const path = require("path");
const os = require("os");
const uuid = require("uuid");
const traceSource_1 = require("./tracing/traceSource");
const util_1 = require("./util");
const config = require("./config");
const telemetry_1 = require("./telemetry/telemetry");
const telemetryStrings_1 = require("./telemetry/telemetryStrings");
/**
 * Manages the lifecycle of the Cascade agent.
 */
class Agent {
    /**
     * Runs the agent. This promise resolves when the process outputs a "Listening" message.
     *
     * @param pipe The name of a pipe the agent should listen on.
     * @param service Optional URI of the web service the agent should use.
     */
    static async start(pipe, service) {
        if (Agent.IsRunning) {
            return Promise.reject('Agent process already running.');
        }
        let startEvent = telemetry_1.Instance.startTimedEvent(telemetryStrings_1.TelemetryEventNames.START_AGENT);
        telemetry_1.TimedEvent.propagateOffsetMarkTime(telemetryStrings_1.TelemetryPropertyNames.AGENT_SPAWN_START_TIME, startEvent);
        Agent.trace = traceSource_1.traceSource.withName(traceSource_1.TraceSources.ClientAgent);
        let args = ['--autoexit', '--pipe', pipe];
        if (service) {
            args = args.concat('--service', url.format(service));
        }
        try {
            await this.dependencyCheck();
        }
        catch (e) {
            return Promise.reject('Agent dependency check failed.');
        }
        return new Promise((rawResolve, rawReject) => {
            const reject = (e, site = 'not specified') => {
                startEvent.end(telemetry_1.TelemetryResult.Failure, `Agent start failed [${site}] - ${e.message}`);
                telemetry_1.TimedEvent.propagateOffsetMarkTime(telemetryStrings_1.TelemetryPropertyNames.AGENT_SPAWN_END_TIME, startEvent);
                rawReject(e);
            };
            const resolve = () => {
                startEvent.end(telemetry_1.TelemetryResult.Success, 'Agent start success.');
                telemetry_1.TimedEvent.propagateOffsetMarkTime(telemetryStrings_1.TelemetryPropertyNames.AGENT_SPAWN_END_TIME, startEvent);
                rawResolve();
            };
            let agentPath = Agent.getAgentPath();
            process.env[Agent.keepAliveIntervalEnvironmentVariableName] = config.get(config.Key.keepAliveInterval);
            Agent.cp = child_process.spawn(agentPath, args, { env: process.env });
            startEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.AGENT_START_PROCESS_SPAWN_COMMAND_SENT);
            let errorMessage = '';
            let resolved = false;
            setTimeout(() => {
                try {
                    if (!resolved) {
                        resolved = true;
                        Agent.cp.kill();
                        const message = 'Timed out waiting for agent process to start.';
                        Agent.trace.info(message);
                        reject(new Error(message), 'init timeout');
                    }
                }
                catch (e) {
                    reject(e, 'init timeout error');
                }
                // two minutes
            }, 2 * 60 * 1000);
            let agentOutput = readline_1.createInterface({
                input: Agent.cp.stdout
            });
            agentOutput.on('line', (line) => {
                try {
                    // Resolve when the agent outputs a message that indicates it is listening.
                    // Afterward the client can connect to the agent without having to wait and retry.
                    Agent.trace.writeLine(line);
                    if (traceSource_1.TraceFormat.parseEventId(line) === traceSource_1.TraceEventIds.AgentLogCreated) {
                        let linePieces = line.split('Trace log: ');
                        if (linePieces.length > 1) {
                            util_1.ExtensionUtil.agentLogFilePath = linePieces[1];
                        }
                    }
                    if (!startEvent.propertyExists(telemetryStrings_1.TelemetryPropertyNames.AGENT_START_INITAL_DATA)) {
                        startEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.AGENT_START_INITAL_DATA, line);
                        startEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.AGENT_START_RESOLVED_STATE, resolved.toString());
                    }
                    if (!resolved && traceSource_1.TraceFormat.parseEventId(line) === traceSource_1.TraceEventIds.RpcListeningOnPipe) {
                        resolved = true;
                        Agent.isStarted = true;
                        // The agent doesn't really start listening until immediately after
                        // this event. Wait a short time to reduce the chance of needing to retry.
                        setTimeout(resolve, 10);
                    }
                }
                catch (e) {
                    reject(e, 'on line');
                }
            });
            Agent.cp.stderr.on('data', async (data) => {
                if (!resolved && os.platform() === util_1.OSPlatform.LINUX) {
                    await util_1.ExtensionUtil.promptLinuxDependencyInstall('VS Live Share activation failed.');
                }
                try {
                    const message = (data || '').toString().trim();
                    if (!resolved) {
                        errorMessage += message;
                    }
                    else {
                        Agent.trace.info(message);
                    }
                }
                catch (e) {
                    reject(e, 'on data');
                }
            });
            Agent.cp.on('error', async (err) => {
                try {
                    Agent.trace.error('Agent failed with error: ' + err);
                    if (!resolved) {
                        if (err.message.indexOf('spawn') > -1) {
                            const found = fs.existsSync(agentPath);
                            startEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.AGENT_START_AGENT_FOUND, found);
                        }
                        resolved = true;
                        reject(err, 'on error before init');
                    }
                }
                catch (e) {
                    reject(e, 'on error');
                }
            });
            Agent.cp.on('close', (exitCode, signal) => {
                try {
                    const message = `Agent terminated with exit code: ${exitCode} and signal ${signal}: ${errorMessage}`;
                    Agent.trace.info(message);
                    if (!resolved) {
                        resolved = true;
                        reject(new Error(message), 'on close before init');
                    }
                }
                catch (e) {
                    reject(e, 'on close');
                }
            });
        });
    }
    static async dependencyCheck() {
        if (os.platform() !== util_1.OSPlatform.LINUX) {
            return;
        }
        return new Promise((resolve, reject) => {
            // Check if there are multiple instances of libssl.so installed
            child_process.exec('dpkg --list libssl1.0.? | grep "^ii"', async (err, stdout, stderr) => {
                if (err) {
                    if (err.message.includes('command not found')) {
                        Agent.trace.info('Agent dependency check for Linux skipped (dpkg not found)');
                    }
                    else {
                        Agent.trace.info('Agent dependency check for Linux failed: ' + err.message);
                    }
                    return resolve();
                }
                const libSslInstances = stdout.trim().split('\n');
                let amd64Count = 0;
                let i386Count = 0;
                let otherCount = 0;
                libSslInstances.forEach(instance => {
                    if (/amd64/.test(instance)) {
                        amd64Count++;
                    }
                    else if (/i386/.test(instance)) {
                        i386Count++;
                    }
                    else {
                        otherCount++;
                    }
                });
                // Ensure that there is only one installed libssl instance, or:
                // If multiple, at most one amd64 or i386 (or unspecified) instance
                if (libSslInstances.length === 1 || (amd64Count <= 1 && i386Count <= 1 && otherCount <= 1 && amd64Count + i386Count + otherCount >= 1)) {
                    return resolve();
                }
                else {
                    let errorDetails = 'Agent dependency check for Linux failed - multiple instances of libssl installed';
                    Agent.trace.info(errorDetails + ':\n' + libSslInstances.join('\n'));
                    const moreInfo = 'More Info';
                    const result = await vscode_1.window.showErrorMessage('VS Live Share has failed to start because multiple sub-versions of libssl1.0 are installed. Remove one of these sub-versions and try again.', moreInfo);
                    if (result === moreInfo) {
                        util_1.ExtensionUtil.openBrowser('https://aka.ms/vsls-docs/linux-required-lib-details');
                    }
                    return reject(new Error(errorDetails));
                }
            });
        });
    }
    static async startIfNotRunning() {
        if (Agent.IsRunning) {
            return Agent.uri;
        }
        else {
            let agentUri = config.getUri(config.Key.agentUri);
            if (!agentUri) {
                const uniquePipeName = uuid().replace(/-/g, '');
                agentUri = url.parse('net.pipe://localhost/' + uniquePipeName);
                const serviceUri = config.getUri(config.Key.serviceUri);
                await Agent.start(uniquePipeName, serviceUri);
                Agent.uri = agentUri;
            }
            return agentUri;
        }
    }
    static get IsRunning() {
        return (Agent.cp && !Agent.cp.killed);
    }
    static stop() {
        if (Agent.IsRunning) {
            Agent.cp.kill();
            Agent.cp = undefined;
        }
    }
    static async disposeAsync() {
        // The agent process exits automatically when the rpc connection is disposed.
        // Wait for that to happen as that'll also perform some cleanup.
        // If that still hasn't happened then kill the process.
        if (Agent.IsRunning) {
            Agent.trace.info('Agent process is running and about to be shutdown.');
            if (!await Agent.WaitForAgentToExit()) {
                Agent.trace.info('Agent process didn\'t exit within the timeout, killing it.');
                Agent.stop();
            }
        }
    }
    static getAgentPath() {
        return os.platform() === util_1.OSPlatform.WINDOWS ?
            path.join(Agent.agentBinariesPath, `${config.get(config.Key.agent)}.exe`) :
            path.join(Agent.agentBinariesPath, `${config.get(config.Key.agent)}`);
    }
    static WaitForAgentToExit() {
        if (Agent.IsRunning) {
            return new Promise((resolve, reject) => {
                Agent.cp.on('close', (exitCode, signal) => {
                    resolve(true);
                });
                setTimeout(() => resolve(false), Agent.EXIT_TIMEOUT);
            });
        }
        return Promise.resolve(true);
    }
}
Agent.agentBinariesPath = path.join(__filename, '..', '..', '..', 'dotnet_modules');
Agent.EXIT_TIMEOUT = 1000;
Agent.keepAliveIntervalEnvironmentVariableName = 'VSLS_SESSION_KEEPALIVE_INTERVAL';
Agent.isStarted = false;
exports.Agent = Agent;

//# sourceMappingURL=agent.js.map
