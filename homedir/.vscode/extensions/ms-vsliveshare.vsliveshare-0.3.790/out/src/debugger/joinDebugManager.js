"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
const path = require("path");
const fs = require("fs");
const os = require("os");
const uuid = require("uuid");
const vscode = require("vscode");
const jsonc = require("jsonc-parser");
const rpc = require("vscode-jsonrpc");
const traceSource_1 = require("../tracing/traceSource");
const VSLS_1 = require("../contracts/VSLS");
const util_1 = require("../util");
const telemetry_1 = require("../telemetry/telemetry");
const telemetryStrings_1 = require("../telemetry/telemetryStrings");
const config = require("../config");
const debugEvents_1 = require("../workspace/contract/debugEvents");
const adapterExecutableProvider_1 = require("./adapterExecutableProvider");
const shareDebugManager_1 = require("./shareDebugManager");
const remoteDebug_1 = require("./remoteDebug");
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const pathManager_1 = require("../languageService/pathManager");
const vsls = require("../contracts/VSLS");
const session_1 = require("../session");
var JoinDebugSessionOption;
(function (JoinDebugSessionOption) {
    JoinDebugSessionOption["Automatic"] = "Automatic";
    JoinDebugSessionOption["Manual"] = "Manual";
    JoinDebugSessionOption["Prompt"] = "Prompt";
})(JoinDebugSessionOption = exports.JoinDebugSessionOption || (exports.JoinDebugSessionOption = {}));
class JoinDebugManager {
    constructor(rpcClient, workspaceId, workspaceProvider, debuggerHostService, hostAdapterService) {
        this.rpcClient = rpcClient;
        this.workspaceId = workspaceId;
        this.workspaceProvider = workspaceProvider;
        this.debuggerHostService = debuggerHostService;
        this.hostAdapterService = hostAdapterService;
        this.sharedDebugSessions = [];
        this.unmodifiedLaunchConfigurations = new Map();
        // Keep track to all the the active joined debug sessions
        this.eventRegistrations = [];
        this.activeJoinedDebugSessions = new Map();
        this.activeEventNotifications = new Map();
        // initialize unique join id
        this.joinUniqueId = uuid();
        // Create our trace source
        this.trace = traceSource_1.traceSource.withName(traceSource_1.TraceSources.DebugRemote);
        // register 'cascade' to intercept our launch configurations
        vscode.debug.registerDebugConfigurationProvider(JoinDebugManager.typeJoinDebug, this);
        // advise to start/terminate vsCode debug sessions
        vscode.debug.onDidStartDebugSession(this.onDidStartDebugSession, this, this.eventRegistrations);
        vscode.debug.onDidTerminateDebugSession(this.onDidTerminateDebugSession, this, this.eventRegistrations);
        vscode.debug.onDidReceiveDebugSessionCustomEvent(this.onDidReceiveDebugSessionCustomEvent, this, this.eventRegistrations);
        const joinDebugSessionOptionSetting = config.get(config.Key.joinDebugSessionOption);
        this.joinDebugSessionOptionValue = JoinDebugSessionOption[joinDebugSessionOptionSetting];
        // register adapter executable provider
        this.adapterExecutableProvider = new adapterExecutableProvider_1.AdapterExecutableProvider('Microsoft.Cascade.VSCodeAdapter', this.trace);
        vscode.debug.registerDebugConfigurationProvider(JoinDebugManager.typeJoinDebug, this.adapterExecutableProvider);
        // register '*' to intercept all possible types
        vscode.debug.registerDebugConfigurationProvider('*', this);
        // register myself as a workspace provider
        // Note: workspaceProvider will be undefined in versions of vscode < 1.23.0
        if (workspaceProvider) {
            workspaceProvider.registerWorkspaceProvider(this);
        }
    }
    async initialize() {
        // start listening to debugger events
        this.debuggerHostService.onDebugSessionChanged(this.onDebugSessionChanged, this, this.eventRegistrations);
        this.debuggerHostService.onLaunchConfigurationsChanged(this.onLaunchConfigurationsChanged, this, this.eventRegistrations);
        let initDebuggingTelemetryEvent = telemetry_1.Instance.startTimedEvent(telemetryStrings_1.TelemetryEventNames.INITIALIZE_DEBUGGING, true);
        this.sharedDebugSessions = await this.debuggerHostService.getCurrentDebugSessionsAsync();
        initDebuggingTelemetryEvent.addMeasure(telemetryStrings_1.TelemetryPropertyNames.NUM_DEBUGGING_PROCESSES, this.sharedDebugSessions ? this.sharedDebugSessions.length : 0);
        if (this.sharedDebugSessions && this.sharedDebugSessions.length > 0) {
            const launchDebugSessions = this.sharedDebugSessions.slice(0);
            const launchAll = () => {
                const sessionLaunches = launchDebugSessions.map(item => {
                    // check if the debug session is still valid
                    if (this.isDebugSessionValid(item)) {
                        return this.joinDebugSession(item);
                    }
                    return null;
                });
                return Promise.all(sessionLaunches);
            };
            initDebuggingTelemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.DEBUG_PROMPT, (this.joinDebugSessionOptionValue === JoinDebugSessionOption.Prompt).toString());
            if (this.joinDebugSessionOptionValue === JoinDebugSessionOption.Automatic) {
                await launchAll();
            }
            else if (this.joinDebugSessionOptionValue === JoinDebugSessionOption.Prompt) {
                const result = await vscode.window.showInformationMessage('The owner is already in a collaborative debugging session that you can join', { title: 'Join session now' });
                if (result) {
                    await launchAll();
                }
            }
        }
        session_1.SessionContext.joiningOnDebugComplete();
        // retrieve all remote launch configurations
        try {
            this.setLaunchConfigurations(await this.debuggerHostService.getLaunchConfigurationsAsync());
        }
        catch (error) {
            if (error instanceof vscode_jsonrpc_1.ResponseError && error.code === rpc.ErrorCodes.MethodNotFound) {
                this.setLaunchConfigurations(null);
            }
            else {
                throw error;
            }
        }
        initDebuggingTelemetryEvent.end(telemetry_1.TelemetryResult.Success);
    }
    dispose() {
        this.eventRegistrations.forEach((r) => r.dispose());
    }
    /*
    Return the available debug sessions that can be started by looking on the shared debug sessions
    and filter the already joined sessions
    */
    getAvailableDebugSessions() {
        return this.sharedDebugSessions.filter(i => {
            return !this.activeJoinedDebugSessions.has(i.sessionId);
        });
    }
    async launchRemoteDebugConfiguration(workspaceFolder, debugConfiguration) {
        // find the original 'raw' debug configuration without any 'injection' from a provider
        const configurationForRoot = this.unmodifiedLaunchConfigurations.get(workspaceFolder ? workspaceFolder.index.toString() : '0');
        // We haven't had any configurations yet, so lets just inform VS Code that
        // we don't have anything to offer, and let it fall back to generating
        // launch.json. This can happen sometimes, depending on state (e.g. nodejs
        // app that supports automatic debugging)
        if (!configurationForRoot) {
            return null;
        }
        let rawDebugConfiguration = configurationForRoot.find(lc => lc.name === debugConfiguration.name);
        if (rawDebugConfiguration) {
            const remoteDebugConfiguration = {};
            Object.assign(remoteDebugConfiguration, rawDebugConfiguration);
            // inject launch unique id to allow terminate on disconnect
            remoteDebugConfiguration.launchUniqueId = this.joinUniqueId;
            // inject noDebug property from the requested configuration
            if (debugConfiguration.noDebug) {
                remoteDebugConfiguration.noDebug = true;
            }
            if (workspaceFolder) {
                remoteDebugConfiguration.__workspaceIndex = workspaceFolder.index;
            }
            // invoke remote launch using the RPC service
            try {
                await this.debuggerHostService.launchDebugSessionAsync(remoteDebugConfiguration);
            }
            catch (error) {
                if (error instanceof vscode_jsonrpc_1.ResponseError && error.code === vsls.ErrorCodes.RemoteLaunchNotEnabled) {
                    await vscode.window.showInformationMessage(util_1.ExtensionUtil.getString('error.RemoteLaunchNotEnabled'));
                }
                else {
                    throw error;
                }
            }
            // Return a remote join type (it will quickly terminate since we are waiting for the real host debug session)
            return JoinDebugManager.vsRemoteLaunchConfiguration;
        }
        return null;
    }
    async resolveDebugConfiguration(folder, debugConfiguration, token) {
        // Note: vscode will sometimes call 'resolveDebugConfiguration' twice on a single call to 'vscode.debug.startDebugging'.
        // This causes our property injection to run twice with the side effect of blocking our serialization on the
        // adapter execute provider implementation
        if (debugConfiguration.type === remoteDebug_1.RemoteDebugSession.typeRemoteJoin ||
            (debugConfiguration.type === JoinDebugManager.typeJoinDebug && debugConfiguration.joinUniqueId)) {
            return debugConfiguration;
        }
        if (debugConfiguration.type !== JoinDebugManager.typeJoinDebug) {
            if (shareDebugManager_1.ShareDebugManager.typeSharedDebug === debugConfiguration.type) {
                debugConfiguration = debugConfiguration.adapterProxy.configuration;
            }
            return await this.launchRemoteDebugConfiguration(folder, debugConfiguration);
        }
        // Note: if no debugSession object is found mean the launch is being initiated by a 'restart' action
        // and so we would need to locate the shared debug session that should exists (otherwise we can't proceed)
        if (!debugConfiguration.debugSession) {
            const targetDebugSession = this.sharedDebugSessions.find(ds => ds.configurationProperties.name === debugConfiguration.name);
            if (!targetDebugSession) {
                // this restart may have been initiated by our session and so implies the shared debug session was terminated
                return await this.launchRemoteDebugConfiguration(folder, debugConfiguration);
            }
            debugConfiguration = this.toDebugConfiguration(targetDebugSession);
        }
        // TODO: we still need to pass a local path to the file service created by our adapter
        // but for VSCode it won't be used since we are starting to use the vsls: scheme
        let wsLocalPath = path.join(os.tmpdir(), this.workspaceId);
        if (!fs.existsSync(wsLocalPath)) {
            fs.mkdirSync(wsLocalPath);
        }
        debugConfiguration.joinUniqueId = this.joinUniqueId;
        debugConfiguration.localPath = wsLocalPath;
        debugConfiguration.pipeName = this.hostAdapterService.pipeName;
        const adapterArguments = [];
        const capabilities = debugConfiguration.debugSession.capabilities;
        if (capabilities) {
            const json = JSON.stringify(capabilities);
            const encodedCapabilities = Buffer.from(json).toString('base64');
            adapterArguments.push('--capabilities64', encodedCapabilities);
        }
        await this.adapterExecutableProvider.setAdapterArguments(adapterArguments);
        return debugConfiguration;
    }
    async joinDebugSession(debugSession) {
        const folders = vscode.workspace.workspaceFolders;
        await vscode.debug.startDebugging(folders ? folders[0] : undefined, this.toDebugConfiguration(debugSession));
    }
    isDebugSessionValid(debugSession) {
        return this.sharedDebugSessions.find((d) => d.sessionId === debugSession.sessionId) !== undefined;
    }
    toDebugConfiguration(debugSession) {
        const name = path.parse(debugSession.name).base;
        const isLaunch = debugSession.configurationProperties &&
            debugSession.configurationProperties.launchUniqueId === this.joinUniqueId;
        const noDebug = debugSession.configurationProperties &&
            debugSession.configurationProperties.noDebug;
        return {
            type: JoinDebugManager.typeJoinDebug,
            request: isLaunch ? 'launch' : 'attach',
            name: name,
            noDebug: noDebug,
            debugSession: debugSession,
            debugServer: config.get(config.Key.debugAdapter),
            enableMultipleRoots: config.featureFlags.multiRootWorkspaceVSCode
        };
    }
    async onDidStartDebugSession(eventData) {
        if (eventData.type === JoinDebugManager.typeJoinDebug) {
            this.trace.info(`Starting joined debug session:${eventData.id} name:${eventData.name}`);
            // store the shared debug session id and the vsCode debug session
            let response = await eventData.customRequest('debugSessionId');
            let sharedDebugSessionId = response.Id;
            this.activeJoinedDebugSessions.set(sharedDebugSessionId, eventData);
            // add notifications handlers
            const uiDebugEventName = JoinDebugManager.getDebugSessionServiceEventName(sharedDebugSessionId, JoinDebugManager.uiDebugEventName);
            const cookie = this.rpcClient.addNotificationHandler(uiDebugEventName, async (...params) => {
                await this.onUIDebugEvent(sharedDebugSessionId, params[0].body);
            });
            this.activeEventNotifications.set(sharedDebugSessionId, [{ eventName: uiDebugEventName, cookie: cookie }]);
            // Note: if we just receive the event on our joined debug session, it could
            // happen that the shared debug session is already finished
            if (!this.sharedDebugSessions.find((d) => d.sessionId === sharedDebugSessionId)) {
                this.trace.verbose(`Terminate ${eventData.id} due to removed shared debug session id:${sharedDebugSessionId}`);
                eventData.customRequest('forceTerminate');
            }
        }
    }
    onDidTerminateDebugSession(eventData) {
        if (eventData.type === JoinDebugManager.typeJoinDebug) {
            this.trace.info(`Terminate joined debug session:${eventData.id}`);
            for (let [key, value] of this.activeJoinedDebugSessions) {
                if (value.id === eventData.id) {
                    // remove notification handlers
                    this.activeEventNotifications.get(key).forEach(item => {
                        this.rpcClient.removeNotificationHandler(item.eventName, item.cookie);
                    });
                    this.activeEventNotifications.delete(key);
                    this.activeJoinedDebugSessions.delete(key);
                    break;
                }
            }
        }
    }
    async onDidReceiveDebugSessionCustomEvent(eventData) {
        if (eventData.event === JoinDebugManager.insufficientAccessExceptionEventType) {
            await vscode.window.showErrorMessage(eventData.body.Message);
        }
    }
    // Called when a UIDebugEvent is notified from a shared debug session
    async onUIDebugEvent(sharedDebugSessionId, e) {
        if (e.type === debugEvents_1.UIDebugEventTypes.debugMessage) {
            const debugMessageEvent = e;
            if (debugMessageEvent.MessageType & debugEvents_1.DebugMessageType.MessageBox) {
                await vscode.window.showInformationMessage(`The host’s debug session has been paused for the following reason: '${debugMessageEvent.Message}'`);
            }
        }
    }
    async onDebugSessionChanged(eventData) {
        if (eventData.changeType === VSLS_1.DebugSessionChangeType.Add) {
            this.trace.info(`Host debug session started:${eventData.debugSession.sessionId}`);
            this.sharedDebugSessions.push(eventData.debugSession);
            if (this.joinDebugSessionOptionValue === JoinDebugSessionOption.Automatic) {
                await this.joinDebugSession(eventData.debugSession);
            }
            else if (this.joinDebugSessionOptionValue === JoinDebugSessionOption.Prompt) {
                const result = await vscode.window.showInformationMessage(`The owner has started a collaborative debugging session ('${eventData.debugSession.name}') that you can join`, { title: 'Join session now' });
                if (result) {
                    if (this.isDebugSessionValid(eventData.debugSession)) {
                        await this.joinDebugSession(eventData.debugSession);
                    }
                }
            }
        }
        else if (eventData.changeType === VSLS_1.DebugSessionChangeType.Remove) {
            let debugSessionId = eventData.debugSession.sessionId;
            this.trace.info(`Host debug session removed:${debugSessionId}`);
            // track the shared debugged sessions
            let index = this.sharedDebugSessions.findIndex((d) => d.sessionId === debugSessionId);
            if (index >= 0) {
                this.sharedDebugSessions.splice(index, 1);
            }
            // if we have a joined debug session make sure we terminate it
            if (this.activeJoinedDebugSessions.has(eventData.debugSession.sessionId)) {
                this.trace.verbose(`Attempt to terminate joined debug session:${eventData.debugSession.sessionId}`);
                await this.activeJoinedDebugSessions.get(eventData.debugSession.sessionId).customRequest('forceTerminate');
            }
        }
    }
    /**
     * Sets the actual launch configurations from the 'raw' information provided
     * by the host. We want to hold onto this information, rather than take the
     * info that comes when resolve/launching so that any properties that have
     * been injected by _local_ adapters/extensions aren't pushed to the host.
     *
     * Additionally, rather than look up the "name" and hope things are OK, there
     * are times we want to inject information on the host via the guest. NoDebug
     * is a good example of something we want to add.
     *
     * So, we store the raw configs for us to pass along when we _actually_ begin
     * the debugging session.
     */
    setLaunchConfigurations(rawLaunchConfiguration) {
        this.unmodifiedLaunchConfigurations = new Map();
        this.rawLaunchConfigurationData = rawLaunchConfiguration;
        if (!rawLaunchConfiguration) {
            return;
        }
        let launchContentObject = rawLaunchConfiguration;
        if (typeof rawLaunchConfiguration === 'string') {
            try {
                // Use jsonc so we handle comments in launch configurations
                launchContentObject = jsonc.parse(rawLaunchConfiguration);
            }
            catch (_a) {
                return;
            }
        }
        this.unmodifiedLaunchConfigurations.set('0', launchContentObject.configurations instanceof Array ? launchContentObject.configurations : []);
        if (!launchContentObject.configurationsByRoot) {
            return;
        }
        // It was multiroot, so extract the per-root configurations
        const configurationsByRoot = launchContentObject.configurationsByRoot;
        const rootkeys = Object.keys(configurationsByRoot);
        for (let key of rootkeys) {
            const root = configurationsByRoot[key];
            if (!root || !(root.configurations instanceof Array)) {
                continue;
            }
            this.unmodifiedLaunchConfigurations.set(key, root.configurations);
        }
    }
    isLaunchConfigurationsExists() {
        return this.rawLaunchConfigurationData != null;
    }
    onLaunchConfigurationsChanged(eventData) {
        // update launch configurations
        this.setLaunchConfigurations(eventData.launchConfigurations);
        let launchJsonPath = JoinDebugManager.vscodeLaunchPath;
        // fire file system event in case debugger want to refresh the combo box options
        if (this.workspaceProvider) {
            const launchFileChanged = {
                type: vscode.FileChangeType.Changed,
                uri: (pathManager_1.PathManager.getPathManager()).relativePathToLocalPath(launchJsonPath)
            };
            this.workspaceProvider.fireFilesChanged([launchFileChanged]);
        }
    }
    async onReadFile(fileTextInfo) {
        const { moniker } = util_1.PathUtil.getMonikerFromRelativePath(fileTextInfo.path);
        // The reason we're injecting contents of the  .vscode/launch.json file
        // is to ensure that when connected to VS, we have information to work
        // with that allows us to start a debugger session. Since VS Projects all
        // it's debug information through tasks or debugger info in the _primary_
        // root, we don't need to do anything if this this isn't the primary root:
        // The default file system information represents the truth.
        //
        // Note, it's not possible to just rely on _not_injecting the file in
        // read directory or stat calls, since there are times that VS Code
        // directly tries to read the file.
        if (moniker !== '0' && moniker) {
            return Promise.resolve();
        }
        // If the file exists, we don't have anything to return, or it's not a file we care about
        // let the request pass through unmodified, since it's reporting accurate
        // information already.
        if (!this.isLaunchConfigurationsExists() || fileTextInfo.path !== JoinDebugManager.vscodeLaunchPath) {
            return;
        }
        // for the existance of this file
        fileTextInfo.exists = true;
        const isLaunchText = typeof this.rawLaunchConfigurationData === 'string';
        fileTextInfo.text = isLaunchText ? this.rawLaunchConfigurationData.toString() : JSON.stringify(this.rawLaunchConfigurationData, null, 4);
        // if launch configurations is not a raw text we don't want co-editing to start, hence the 'hidden' attribute
        fileTextInfo.attributes = isLaunchText ? undefined : vsls.FileAttributes.Hidden;
    }
    onReadDirectory(fileInfos) {
        if (fileInfos.length < 1 || !this.isLaunchConfigurationsExists()) {
            return Promise.resolve();
        }
        const fileInfoItem = fileInfos[0];
        const { moniker } = util_1.PathUtil.getMonikerFromRelativePath(fileInfoItem.path);
        // The reason we're injecting the .vscode folder & the .vscode/launch.json
        // file is to ensure that when connected to VS, we have information to work
        // with that allows us to start a debugger session. Since VS Projects all
        // it's debug information through tasks or debugger info in the _primary_
        // root, we don't need to do anything if this this isn't the primary root:
        // The default file system information represents the truth.
        if (moniker !== '0' && moniker) {
            return Promise.resolve();
        }
        // Ensure that there is always '.vscode' directory presended to the
        // guest, even if one doesn't exist. We do this by inserting one into
        // the list of of directories
        if (fileInfoItem.path === '/' && !fileInfoItem.children.some((fi) => fi.path === JoinDebugManager.vscodePath)) {
            fileInfoItem.children.push({
                path: JoinDebugManager.vscodePath,
                isDirectory: true,
                hasChildren: true
            });
            return Promise.resolve();
        }
        // When the '.vscode' directory is being read to ensure that there is
        // a launch.json file available, even if there isn't one physically present
        if ((fileInfoItem.path !== JoinDebugManager.vscodePath)
            || (fileInfoItem.children && fileInfoItem.children.find((fi) => fi.path === JoinDebugManager.vscodeLaunchPath))) {
            return Promise.resolve();
        }
        // no launch.json exists on host but we still want to return one
        fileInfoItem.exists = true;
        fileInfoItem.isDirectory = true;
        const launchFileInfo = {
            path: JoinDebugManager.vscodeLaunchPath,
            isDirectory: false,
            hasChildren: false
        };
        if (!fileInfoItem.children) {
            fileInfoItem.children = [];
        }
        fileInfoItem.children.push(launchFileInfo);
        return Promise.resolve();
    }
    onStat(fileInfos) {
        const fileInfoItem = fileInfos[0];
        // File exists, then theres nothing for us to do, or if we have no
        // configuration to lie about.
        if ((!fileInfoItem || fileInfoItem.exists) || !this.isLaunchConfigurationsExists()) {
            return Promise.resolve();
        }
        const { moniker } = util_1.PathUtil.getMonikerFromRelativePath(fileInfoItem.path);
        // The reason we're injecting contents of the  .vscode/launch.json file
        // is to ensure that when connected to VS, we have information to work
        // with that allows us to start a debugger session. Since VS Projects all
        // it's debug information through tasks or debugger info in the _primary_
        // root, we don't need to do anything if this this isn't the primary root:
        // The default file system information represents the truth.
        //
        // Note, it's not possible to just rely on _not_injecting the file in
        // read directory calls, since there are times that VS Code directly
        // tries to stat the file.
        if ((moniker !== '0' && moniker)
            || (fileInfoItem.path !== JoinDebugManager.vscodePath && fileInfoItem.path !== JoinDebugManager.vscodeLaunchPath)) {
            return Promise.resolve();
        }
        fileInfoItem.exists = true;
        fileInfoItem.mtime = new Date(0);
        fileInfoItem.isDirectory = (fileInfoItem.path === JoinDebugManager.vscodePath);
        return Promise.resolve();
    }
    // Return the service name being published by the host for an active debug session
    static getDebugSessionServiceEventName(debugSessionId, eventName) {
        return JoinDebugManager.debugSessionHostServiceName + '-' + debugSessionId + '.' + eventName;
    }
}
JoinDebugManager.typeJoinDebug = 'vslsJoin';
JoinDebugManager.vsRemoteLaunchConfiguration = {
    type: remoteDebug_1.RemoteDebugSession.typeRemoteJoin,
    name: 'Remote debug launch',
    request: 'launch'
};
JoinDebugManager.debugSessionHostServiceName = 'DebugSessionHostService';
JoinDebugManager.uiDebugEventName = 'uIDebugEvent';
JoinDebugManager.vscodePath = '/.vscode';
JoinDebugManager.vscodeLaunchPath = '/.vscode/launch.json';
JoinDebugManager.insufficientAccessExceptionEventType = 'insufficientAccessException';
exports.JoinDebugManager = JoinDebugManager;

//# sourceMappingURL=joinDebugManager.js.map
