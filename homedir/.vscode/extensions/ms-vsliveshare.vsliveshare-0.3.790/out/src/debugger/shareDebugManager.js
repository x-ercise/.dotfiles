"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
const vscode = require("vscode");
const traceSource_1 = require("../tracing/traceSource");
const vsls = require("../contracts/VSLS");
const VSLS_1 = require("../contracts/VSLS");
const joinDebugManager_1 = require("./joinDebugManager");
const remoteDebug_1 = require("./remoteDebug");
const adapterExecutableProvider_1 = require("./adapterExecutableProvider");
const config = require("../config");
const util = require("../util");
const fs = require("fs-extra");
const util_1 = require("../util");
const path = require("path");
const sessionTypes_1 = require("../sessionTypes");
const telemetry_1 = require("../telemetry/telemetry");
const telemetryStrings_1 = require("../telemetry/telemetryStrings");
const jsonc = require("jsonc-parser");
const session_1 = require("../session");
const restrictedOperation_1 = require("../accessControl/restrictedOperation");
class ShareDebugManager {
    constructor(rpcClient, hostAdapterService, fileService, debugManager, accessControlManager) {
        this.rpcClient = rpcClient;
        this.hostAdapterService = hostAdapterService;
        this.fileService = fileService;
        this.debugManager = debugManager;
        this.accessControlManager = accessControlManager;
        this.activeDebugSessions = [];
        this.onDebugSessionCustomEvent = async (eventData) => {
            if (eventData.event === 'launchOrAttach') {
                const launchConfiguration = eventData.body.LaunchConfiguration;
                if (launchConfiguration.type === 'extensionHost' && launchConfiguration.request === 'attach') {
                    this.trace.info(`Attach to the extension Host port completed`);
                    // Note: we need to push the session id property to the second adapter session
                    eventData.session.customRequest('setSessionId', eventData.session.id);
                    const index = this.activeDebugSessions.findIndex((d) => d.sessionId === eventData.session.id);
                    if (this.isSharing && index >= 0) {
                        await ShareDebugManager.requestShare(eventData.session, true);
                        this.notifySharedDebugSession(this.activeDebugSessions[index], true);
                    }
                }
            }
        };
        // Create our trace source
        this.trace = traceSource_1.traceSource.withName(traceSource_1.TraceSources.DebugRpcHost);
        this.onDidStartDebugSessionEvt = vscode.debug.onDidStartDebugSession(this.onDidStartDebugSession, this);
        this.onDidTerminateDebugSessionEvt = vscode.debug.onDidTerminateDebugSession(this.onDidTerminateDebugSession, this);
        this.onDidReceiveDebugSessionCustomEventEvt = vscode.debug.onDidReceiveDebugSessionCustomEvent(this.onDebugSessionCustomEvent, this);
        // register '*' to intercept all possible types
        vscode.debug.registerDebugConfigurationProvider('*', this);
        // register adapter executable provider
        this.adapterExecutableProvider = new adapterExecutableProvider_1.AdapterExecutableProvider('Microsoft.Cascade.VSCodeHostAdapter', this.trace);
        vscode.debug.registerDebugConfigurationProvider(ShareDebugManager.typeSharedDebug, this.adapterExecutableProvider);
        this.fileService.onFilesChanged(this.onFilesChanged, this);
    }
    async setShareState(isSharing) {
        if (isSharing) {
            // register myself as the IDebuggerHostService contract
            await this.registerDebuggerHostService(true);
            // handle 'getCurrentDebugSessions' method
            this.rpcClient.addRequestMethod(ShareDebugManager.getDebuggerHostServiceAndName(ShareDebugManager.getCurrentDebugSessionsMethodName), (...params) => {
                return this.activeDebugSessions;
            });
            // handle 'launchDebugSession' method
            this.rpcClient.addRequestMethodWithContext(ShareDebugManager.getDebuggerHostServiceAndName('launchDebugSession'), async (debugConfiguration, context, token) => {
                // Verify if not in read-only mode and has setting allowing this
                await this.accessControlManager.verifyCanPerformOperation(context, ShareDebugManager.launchDebugOperation);
                // When being used against matching extension versions, we
                // may be provided with a workspace to launch against. This
                // is critical because a debug configuration is actually resolved
                // against the workspace. Without it, you'll start the correct
                // debug config, but the wrong paths (e.g. won't find binaries).
                // This leverages an extra property smuggled into the debug
                // config from the client. Default to the primary one if it's
                // not been provided.
                const workspaceFolderIndex = debugConfiguration.__workspaceIndex || 0;
                let folderToDebug = vscode.workspace.workspaceFolders[workspaceFolderIndex];
                this.trace.info(`Starting Debugging for ${debugConfiguration.name}, in workspace ${workspaceFolderIndex}`);
                const result = await vscode.debug.startDebugging(folderToDebug, debugConfiguration);
                if (!result) {
                    throw new Error(`Failed to launch debug configuration:${debugConfiguration.name}, in workpace ${folderToDebug.name}`);
                }
                // When we successfully started debugging, report the workspace
                // we started it for (index), and the total count
                telemetry_1.Instance.sendTelemetryEvent(telemetryStrings_1.TelemetryEventNames.GUEST_INITIATED_DEBUGGING, null, // No Properties
                {
                    [telemetryStrings_1.TelemetryPropertyNames.DEBUGGING_STARTED_WORKSPACE_FOLDER]: workspaceFolderIndex,
                    [telemetryStrings_1.TelemetryPropertyNames.DEBUGGING_STARTED_WORKSPACE_FOLDER_COUNT]: vscode.workspace.workspaceFolders.length,
                });
            });
            // handle 'getLaunchConfigurations' method
            this.rpcClient.addRequestMethod(ShareDebugManager.getDebuggerHostServiceAndName('getLaunchConfigurations'), async (token) => {
                return await ShareDebugManager.getLaunchConfigurationsContent();
            });
        }
        else {
            this.rpcClient.removeRequestMethod(ShareDebugManager.getDebuggerHostServiceAndName(ShareDebugManager.getCurrentDebugSessionsMethodName));
            this.rpcClient.removeRequestMethod(ShareDebugManager.getDebuggerHostServiceAndName('launchDebugSession'));
            this.rpcClient.removeRequestMethod(ShareDebugManager.getDebuggerHostServiceAndName('getLaunchConfigurations'));
            // un-register myself as the IDebuggerHostService contract
            await this.registerDebuggerHostService(false);
        }
        this.isSharing = isSharing;
        // update existing host debug sessions
        for (const item of this.activeDebugSessions) {
            await ShareDebugManager.requestShare(item.vsCodeDebugSession, isSharing);
        }
    }
    static async getAdapterProxyConfig(proxyType) {
        const debuggerExtensionInfo = ShareDebugManager.findDebuggerExtensionInfo(proxyType);
        if (!debuggerExtensionInfo) {
            throw new Error(`Failed to find debugger extension info for type:${proxyType}`);
        }
        return await ShareDebugManager.getAdapterProxyConfigInternal(debuggerExtensionInfo);
    }
    static async requestShare(debugSession, isSharing) {
        await debugSession.customRequest('share', { state: isSharing });
    }
    async registerDebuggerHostService(add) {
        // register myself as the IDebuggerHostService contract
        await this.rpcClient.sendRequest(this.trace, 'workspace.registerServices', null, null, [VSLS_1.DebuggerHostService.name], add ? 'Add' : 'Remove');
    }
    async resolveDebugConfiguration(folder, debugConfiguration, token) {
        this.trace.info(`resolveDebugConfiguration-> debugConfiguration:${JSON.stringify(debugConfiguration)}`);
        if (debugConfiguration.type === undefined ||
            ShareDebugManager.typeSharedDebug === debugConfiguration.type ||
            ShareDebugManager.typeRemoteLaunch === debugConfiguration.type ||
            joinDebugManager_1.JoinDebugManager.typeJoinDebug === debugConfiguration.type ||
            remoteDebug_1.RemoteDebugSession.typeRemoteJoin === debugConfiguration.type ||
            config.get(config.Key.excludedDebugTypes).indexOf(debugConfiguration.type) >= 0 ||
            ShareDebugManager.unsupportedDebugTypes.indexOf(debugConfiguration.type) >= 0) {
            this.trace.info(`Ignore debug configuration of type:${debugConfiguration.type}`);
            // if sharing state has changed enforce the state here when
            if (ShareDebugManager.typeSharedDebug === debugConfiguration.type) {
                // Note: if the type == 'share' but it does not have our magic properties inserted
                // then it is possible that this is a restart created by vscode that is half baked and should be handled
                if (!debugConfiguration.adapterProxy) {
                    const targetDebugSession = ShareDebugManager.getLaunchConfigurationForConfigurationName(debugConfiguration.name);
                    if (targetDebugSession) {
                        vscode.debug.startDebugging(folder, targetDebugSession);
                    }
                    // TODO: since we don't have a good way to abort the debug launch we will use the remote launch as a way
                    // to prevent the launch.json to appear
                    return joinDebugManager_1.JoinDebugManager.vsRemoteLaunchConfiguration;
                }
                // Note: since is vslsShare type debugging we need to push again the proper adapter arguments
                const adapterProxyConfig = debugConfiguration.adapterProxy;
                const adapterProxyConfigInternal = {};
                Object.assign(adapterProxyConfigInternal, adapterProxyConfig);
                // Now remove the 'configuration' property which contains the original debug configuration being proxied
                delete adapterProxyConfigInternal.configuration;
                // build adapter arguments and push
                const adapterArguments = this.createAdapterArguments(adapterProxyConfig.configuration, adapterProxyConfigInternal);
                await this.adapterExecutableProvider.setAdapterArguments(adapterArguments);
            }
            // unsupported proxy type or vlsShare restart
            return debugConfiguration;
        }
        const sharedDebugConfiguration = await this.createSharedDebugConfiguration(debugConfiguration);
        this.trace.info(`resolveDebugConfiguration<- debugConfiguration:${JSON.stringify(sharedDebugConfiguration)}`);
        return sharedDebugConfiguration;
    }
    createAdapterArguments(debugConfiguration, adapterProxyConfigInternal) {
        // Fill additional properties required by the proxy launcher
        adapterProxyConfigInternal.pipeName = this.hostAdapterService.pipeName;
        adapterProxyConfigInternal.type = debugConfiguration.type;
        // pass arguments to our debug host adapter
        const adapterArguments = [
            '--proxyInfoType64', Buffer.from(JSON.stringify(adapterProxyConfigInternal)).toString('base64')
            // uncomment next line if you want to attach a debugger to the PZ debug adapter
            //,'--debug'
        ];
        if (debugConfiguration.debugServer) {
            adapterArguments.push('--proxyDebugServer', debugConfiguration.debugServer);
        }
        if (debugConfiguration.trace) {
            adapterArguments.push('--enableProtocolTraceLog');
        }
        return adapterArguments;
    }
    /**
     * Return a new 'vlsShare' type configuration based on a 'real' debug configuration by injecting addtional properties that
     * will be used by our debug host adapter implementation
     * @param debugConfiguration original 'raw' debug configuration to proxy
     */
    async createSharedDebugConfiguration(debugConfiguration) {
        const debuggerExtensionInfo = ShareDebugManager.findDebuggerExtensionInfo(debugConfiguration.type);
        if (!debuggerExtensionInfo) {
            throw new Error(`Failed to find debugger extension info for type:${debugConfiguration.type}`);
        }
        const adapterProxyConfigInternal = await ShareDebugManager.getAdapterProxyConfigInternal(debuggerExtensionInfo);
        const adapterProxyConfig = {};
        Object.assign(adapterProxyConfig, adapterProxyConfigInternal);
        adapterProxyConfig.configuration = debugConfiguration;
        const folders = vscode.workspace.workspaceFolders;
        let sharedDebugConfiguration = {
            type: ShareDebugManager.typeSharedDebug,
            name: debugConfiguration.name,
            request: debugConfiguration.request,
            pipeName: this.hostAdapterService.pipeName,
            adapterProxy: adapterProxyConfig,
            preLaunchTask: debugConfiguration.preLaunchTask,
            postDebugTask: debugConfiguration.postDebugTask,
            workspaceFolders: folders,
            debugServer: config.get(config.Key.debugHostAdapter),
            enableMultipleRoots: config.featureFlags.multiRootWorkspaceVSCode
        };
        // pass arguments to our debug host adapter
        const adapterArguments = this.createAdapterArguments(debugConfiguration, adapterProxyConfigInternal);
        /**
         * Note: next section will attempt to resolve all the parameters passed as '${command:mycommand}'
         * when passing launch configuration back into the adapter.
         */
        const debuggerConfigurationVars = debuggerExtensionInfo.debuggerConfiguration.variables;
        if (debuggerConfigurationVars) {
            const cts = new vscode.CancellationTokenSource();
            try {
                await ShareDebugManager.resolveCommandValue(debugConfiguration, debuggerConfigurationVars, debugConfiguration, cts);
                if (cts.token.isCancellationRequested) {
                    return undefined;
                }
            }
            finally {
                cts.dispose();
            }
        }
        if (debugConfiguration.launchBrowser && debugConfiguration.launchBrowser.enabled) {
            this.onDidStartDebugSessionWithBrowser();
        }
        // await to push the adapter arguments we want to pass to our debug host adapter
        await this.adapterExecutableProvider.setAdapterArguments(adapterArguments);
        return sharedDebugConfiguration;
    }
    static async resolveCommandValue(debugConfiguration, debuggerConfigurationVars, value, cts) {
        if (typeof value === 'object') {
            for (let key of Object.keys(value)) {
                const resolvedValue = await ShareDebugManager.resolveCommandValue(debugConfiguration, debuggerConfigurationVars, value[key], cts);
                if (cts.token.isCancellationRequested) {
                    break;
                }
                value[key] = resolvedValue;
            }
        }
        else if (typeof value === 'string') {
            const valueStr = value;
            if (valueStr.startsWith(ShareDebugManager.commandPrefix) && valueStr.endsWith('}')) {
                let commandName = valueStr.substr(ShareDebugManager.commandPrefix.length);
                commandName = commandName.substring(0, commandName.length - 1);
                const command = debuggerConfigurationVars[commandName];
                if (command) {
                    const result = await vscode.commands.executeCommand(command, debugConfiguration);
                    if (!result) {
                        cts.cancel();
                    }
                    else {
                        return result;
                    }
                }
            }
        }
        else if (value instanceof Array) {
            const items = value;
            for (let i = 0; i < items.length; i++) {
                const resolvedValue = await ShareDebugManager.resolveCommandValue(debugConfiguration, debuggerConfigurationVars, items[i], cts);
                if (cts.token.isCancellationRequested) {
                    break;
                }
                items[i] = resolvedValue;
            }
        }
        return value;
    }
    async onFilesChanged(e) {
        const changePath = util.PathUtil.getRelativePathFromPrefixedPath(e.changes[0].fullPath);
        if (changePath === '/' + ShareDebugManager.vscodeLaunchPath) {
            const launchConfigurationsContent = await ShareDebugManager.getLaunchConfigurationsContent();
            this.rpcClient.sendNotification(this.trace, ShareDebugManager.getDebuggerHostServiceAndName('launchConfigurationsChanged'), {
                launchConfigurations: launchConfigurationsContent
            });
        }
    }
    async onDidStartDebugSessionWithBrowser() {
        if (session_1.SessionContext.State !== sessionTypes_1.SessionState.Shared || config.get(config.Key.isShareLocalServerHintDisplayed)) {
            return;
        }
        await config.save(config.Key.isShareLocalServerHintDisplayed, true);
        const result = await vscode.window.showInformationMessage('If you want to share your locally running application, use the "Share Server" feature!', { title: 'Learn More' });
        if (result) {
            util_1.ExtensionUtil.openBrowser('https://aka.ms/vsls-docs/vscode/share-local-server');
        }
    }
    async onDidStartDebugSession(eventData) {
        if (eventData.type === ShareDebugManager.typeSharedDebug) {
            this.trace.info(`Starting shared debug session:${eventData.id} name:${eventData.name}`);
            // custom request to inject the debug session Id
            eventData.customRequest('setSessionId', eventData.id);
            const debugSession = await this.toDebugSession(eventData);
            this.activeDebugSessions.push(debugSession);
            // Note: when this event is being fired and the proxied debug type is 'extensionHost' we
            // should not start sharing or either notify about this debug session.
            // When the custom event 'launchOrAttach' is received then we will
            if (this.isSharing && !(debugSession.configurationProperties.type === 'extensionHost')) {
                await ShareDebugManager.requestShare(eventData, true);
                this.notifySharedDebugSession(debugSession, true);
            }
        }
    }
    onDidTerminateDebugSession(eventData) {
        if (eventData.type === ShareDebugManager.typeSharedDebug) {
            this.trace.info(`Terminate shared debug session:${eventData.id}`);
            let index = this.activeDebugSessions.findIndex((d) => d.sessionId === eventData.id);
            if (index >= 0) {
                const debugSession = this.activeDebugSessions[index];
                this.activeDebugSessions.splice(index, 1);
                if (this.isSharing) {
                    this.notifySharedDebugSession(debugSession, false);
                }
            }
        }
    }
    async notifySharedDebugSession(debugSessionInfo, isAdded) {
        this.trace.info(`notifySharedDebugSession id:${debugSessionInfo.sessionId} isAdded:${isAdded}`);
        const debugSessionEventArgs = {
            changeType: isAdded ? VSLS_1.DebugSessionChangeType.Add : VSLS_1.DebugSessionChangeType.Remove,
            debugSession: debugSessionInfo
        };
        this.rpcClient.sendNotification(this.trace, ShareDebugManager.getDebuggerHostServiceAndName(ShareDebugManager.debugSessionChangedEventName), debugSessionEventArgs);
    }
    async toDebugSession(vsCodeDebugSession) {
        const debugSessionInfo = await vsCodeDebugSession.customRequest('debugSessionInfo', {});
        return {
            sessionId: vsCodeDebugSession.id,
            name: vsCodeDebugSession.name,
            processId: undefined,
            vsCodeDebugSession: vsCodeDebugSession,
            capabilities: debugSessionInfo.capabilities,
            configurationProperties: debugSessionInfo.configurationProperties
        };
    }
    static getDebuggerHostServiceAndName(name) {
        return VSLS_1.DebuggerHostService.name + '.' + name;
    }
    /**
     * Return a debugger extension info from all possible extensions
     */
    static findDebuggerExtensionInfo(type) {
        let debuggerConfiguration;
        let debuggerExtension = vscode.extensions.all.find((e) => {
            if (e.packageJSON.contributes && e.packageJSON.contributes.hasOwnProperty('debuggers')) {
                debuggerConfiguration = e.packageJSON.contributes.debuggers.find((d) => d.type === type);
            }
            return debuggerConfiguration;
        });
        if (debuggerExtension && debuggerConfiguration) {
            return {
                extension: debuggerExtension,
                debuggerConfiguration: debuggerConfiguration
            };
        }
        return undefined;
    }
    /**
     * Capture the program and runtime properties to be passed to our host adapter
     */
    static async getAdapterProxyConfigInternal(debuggerExtensionInfo) {
        let adapterProxyConfig = {};
        const adapterConfiguration = debuggerExtensionInfo.debuggerConfiguration;
        // per platform specific properties 'osx' 'linux', 'windows'
        const adapterConfigurationPerPlatform = adapterConfiguration[util.getPlatformProperty()];
        // pass 'runtime' property
        adapterProxyConfig.runtime = ShareDebugManager.getPlatformProperty(adapterConfiguration, adapterConfigurationPerPlatform, 'runtime');
        // If the debugger supports the adapterExecutableCommand property then use it to resolve the
        // program & arguments to be passed to our adapter
        if (adapterConfiguration.hasOwnProperty('adapterExecutableCommand')) {
            const commandId = adapterConfiguration.adapterExecutableCommand;
            const result = await vscode.commands.executeCommand(commandId);
            adapterProxyConfig.program = result.command;
            adapterProxyConfig.arguments = result.args;
        }
        else {
            // otherwise look for program property
            const program = ShareDebugManager.getPlatformProperty(adapterConfiguration, adapterConfigurationPerPlatform, 'program');
            if (program) {
                adapterProxyConfig.program = path.join(debuggerExtensionInfo.extension.extensionPath, program);
            }
        }
        return adapterProxyConfig;
    }
    static getPlatformProperty(adapterConfiguration, adapterConfigurationPerPlatform, propertyName) {
        // start with platform specific if exists
        if (adapterConfigurationPerPlatform && adapterConfigurationPerPlatform.hasOwnProperty(propertyName)) {
            return adapterConfigurationPerPlatform[propertyName];
        }
        // fallback to non-platform configuration
        return adapterConfiguration[propertyName];
    }
    static getLaunchConfigurationForConfigurationName(configurationName) {
        // launch.json configuration
        const launchConfig = vscode.workspace.getConfiguration('launch');
        let configurations = [];
        if (launchConfig) {
            // retrieve configurations values
            configurations = launchConfig.get('configurations') || [];
        }
        return configurations.find((dc) => dc.name === configurationName);
    }
    static async getLaunchConfigurationsContent() {
        const launchJsonsByRoot = vscode.workspace.workspaceFolders.map((folder) => {
            const launchJsonPath = path.join(folder.uri.fsPath, ShareDebugManager.vscodeLaunchPath);
            if (!fs.existsSync(launchJsonPath)) {
                return null;
            }
            try {
                const content = fs.readFileSync(launchJsonPath, 'utf8');
                return {
                    root: folder.index.toString(),
                    content: jsonc.parse(content),
                };
            }
            catch (_a) {
                return null;
            }
        });
        let configuration = null;
        if (launchJsonsByRoot[0] && launchJsonsByRoot[0].content) {
            configuration = launchJsonsByRoot[0].content;
        }
        launchJsonsByRoot.shift();
        if (!launchJsonsByRoot.length) {
            return configuration ? JSON.stringify(configuration) : null;
        }
        let rootsWithContent = 0;
        const configurationsByRoot = {};
        launchJsonsByRoot.forEach((item) => {
            if (!item || !item.content) {
                return;
            }
            rootsWithContent += 1;
            configurationsByRoot[item.root] = item.content;
        });
        if (rootsWithContent === 0) {
            return null;
        }
        if (!configuration) {
            configuration = {};
        }
        configuration.configurationsByRoot = configurationsByRoot;
        return JSON.stringify(configuration);
    }
}
ShareDebugManager.typeSharedDebug = 'vslsShare';
ShareDebugManager.typeRemoteLaunch = 'vslsRemoteLaunch';
ShareDebugManager.commandPrefix = '${command:';
ShareDebugManager.unsupportedDebugTypes = [];
ShareDebugManager.getCurrentDebugSessionsMethodName = 'getCurrentDebugSessions';
ShareDebugManager.debugSessionChangedEventName = 'debugSessionChanged';
ShareDebugManager.vscodeLaunchPath = '.vscode/launch.json';
ShareDebugManager.launchDebugOperation = {
    name: restrictedOperation_1.WellKnownRestrictedOperations.LaunchDebug,
    isEnabled: () => config.get(config.Key.allowGuestDebugControl) || { errorCode: vsls.ErrorCodes.RemoteLaunchNotEnabled, errorMessage: 'Remote launch not enabled.' },
};
exports.ShareDebugManager = ShareDebugManager;

//# sourceMappingURL=shareDebugManager.js.map
