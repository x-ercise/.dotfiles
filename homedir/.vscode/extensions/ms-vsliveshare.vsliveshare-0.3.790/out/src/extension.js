//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const fs = require("fs-extra");
const url = require("url");
require("source-map-support/register");
const traceSource_1 = require("./tracing/traceSource");
const commands_1 = require("./commands");
const statusbar_1 = require("./statusbar");
const service_1 = require("./workspace/service");
const vsls = require("./contracts/VSLS");
const remoteWorkspaceManager_1 = require("./workspace/remoteWorkspaceManager");
const util_1 = require("./util");
const hostAdapterService_1 = require("./debugger/hostAdapterService");
const debugManager_1 = require("./debugger/debugManager");
const config = require("./config");
const config_1 = require("./config");
const launcher_1 = require("./launcher");
const session_1 = require("./session");
const telemetry_1 = require("./telemetry/telemetry");
const telemetryStrings_1 = require("./telemetry/telemetryStrings");
const agent_1 = require("./agent");
const downloader_1 = require("./downloader");
const liveShareApi_1 = require("./api/liveShareApi");
const RemoteTaskProvider = require("./tasks/remoteTaskProvider");
const rpcUtils_1 = require("./utils/rpcUtils");
const rpcTelemetry_1 = require("./telemetry/rpcTelemetry");
const abTestsUtil_1 = require("./abTests/abTestsUtil");
const Dependencies_1 = require("./_new_/Dependencies");
const joinUtilities_1 = require("./workspace/joinUtilities");
const welcomePageUtil_1 = require("./welcomePage/welcomePageUtil");
const FileTreeExplorer_1 = require("./fileTreeExplorer/FileTreeExplorer");
const pathManager_1 = require("./languageService/pathManager");
const telemetryFilters_1 = require("./telemetry/telemetryFilters");
const protocolHandler_1 = require("./protocolHandler");
const AGENT_INIT_JOIN_TIMEOUT = 20000;
let extensionSetup;
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
async function activate(context) {
    session_1.SessionContext.extensionContext = context;
    const settings = vscode.workspace.getConfiguration();
    const workspaceId = settings.get(commands_1.Commands.joinWorkspaceIdSettingName);
    const workspaceFolder = settings.get(commands_1.Commands.joinWorkspaceIdFolderSettingName);
    const workspaceStorageId = context.workspaceState.get(commands_1.Commands.joinWorkspaceIdSettingName);
    if (workspaceId) {
        await context.workspaceState.update(commands_1.Commands.joinWorkspaceIdSettingName, workspaceId);
    }
    if (workspaceFolder) {
        await context.workspaceState.update(commands_1.Commands.joinWorkspaceIdFolderSettingName, workspaceFolder);
    }
    if (!workspaceId && workspaceStorageId && joinUtilities_1.JoinUtilities.isBrokenLiveshareWorkspaceFile(vscode.workspace)) {
        await joinUtilities_1.JoinUtilities.restoreLiveshareWorkspaceState(workspaceStorageId);
    }
    let activationEvent = telemetry_1.Instance.startTimedEvent(telemetryStrings_1.TelemetryEventNames.ACTIVATE_EXTENSION);
    telemetry_1.Instance.setCorrelationEvent(activationEvent);
    telemetry_1.Instance.addContextProperty(telemetryStrings_1.TelemetryPropertyNames.ENVIRONMENT_VECTOR, process.env.VSLS_ENVIRONMENT_VECTOR);
    telemetry_1.Instance.addContextProperty(telemetryStrings_1.TelemetryPropertyNames.IS_DEBUGGING, util_1.checkDebugging().toString());
    context.subscriptions.push(telemetry_1.Instance.reporter);
    let result = null;
    try {
        result = await activateInternal(context, activationEvent);
        if (!result) {
            // at this point we should have already called activationEvent.end()
            // in activateInternal().
            return;
        }
        // NOTE: vvvvvv Activate name extension pipeline vvvvvv
        await activateNew();
        // NOTE: ^^^^^^ Activate name extension pipeline ^^^^^^
    }
    catch (e) {
        session_1.SessionContext.notJoining();
        const fault = e && e.message || '';
        const telemetryMessage = 'Extension activation failed. ' + fault;
        activationEvent.end(telemetry_1.TelemetryResult.Failure, telemetryMessage);
        telemetry_1.Instance.sendActivateExtensionFault(telemetry_1.FaultType.Error, telemetryMessage, e, activationEvent);
        if (fault.indexOf('Proposed API is only available') > -1) {
            throw new Error(`Visual Studio Live Share relies on access "Proposed APIs" that are currently not
                enabled in this version of Visual Studio Code. See https://aka.ms/vsls-proposed-api for
                more details.`);
        }
        throw e;
    }
    activationEvent.end(telemetry_1.TelemetryResult.Success, 'Extension activation success.', false);
    tryJoinSession(activationEvent);
    checkIfShowWhatsNewInfo();
    // initiate protocol handler
    const vslvProtocolHandler = new protocolHandler_1.VSLSProtocolHandler(activationEvent);
    return result;
}
exports.activate = activate;
async function activateInternal(context, activationEvent) {
    await util_1.ExtensionUtil.InitLogging();
    await config.initAsync(context);
    // Assume agent is already running if there is agent URI configured
    agent_1.Agent.isStarted = agent_1.Agent.isStarted || !!config.getUri(config.Key.agentUri);
    const { showExplorer } = config.featureFlags;
    if (showExplorer) {
        session_1.SessionContext.fileTreeExplorerProvider = new FileTreeExplorer_1.FileTreeExplorerProvider(session_1.SessionContext, FileTreeExplorer_1.FileTreeExplorerType.ViewletFileTreeExplorer);
        session_1.SessionContext.activityBarProvider = new FileTreeExplorer_1.FileTreeExplorerProvider(session_1.SessionContext, FileTreeExplorer_1.FileTreeExplorerType.ViewletActivityBar);
        vscode.window.registerTreeDataProvider('vsliveshareTreeExplorer', session_1.SessionContext.fileTreeExplorerProvider);
        vscode.window.registerTreeDataProvider('vsliveshareActivityBar', session_1.SessionContext.activityBarProvider);
    }
    util_1.ExtensionUtil.setCommandContext(commands_1.Commands.showExplorerCommandContext, showExplorer);
    // Set the first activation extension version if it isn't already
    // present in this users's global memento state.
    let isFirstActivation = false;
    if (!config.get(config.Key.firstActivationVersion)) {
        config.save(config.Key.firstActivationVersion, util_1.ExtensionUtil.getVersionInfo().extensionVersion);
        isFirstActivation = true;
    }
    if (config.get(config.Key.isInternal)) {
        traceSource_1.traceSource.info('Feature flags: ' + JSON.stringify(config.featureFlags));
    }
    // Update filters now that user settings have been loaded
    util_1.ExtensionUtil.setLoggingFilters();
    if (config.get(config.Key.logTelemetry)) {
        const telemetryLogFilter = new telemetryFilters_1.LogFilter();
        await telemetryLogFilter.init();
        telemetry_1.Instance.addFilter(telemetryLogFilter);
    }
    const serviceUri = url.format(config.getUri(config.Key.serviceUri));
    telemetry_1.Instance.setServiceEndpoint(serviceUri);
    // Correlate this activation to the join that triggered it (if it was triggered by a join)
    let joinCorrelationId = config.get(config.Key.joinEventCorrelationId);
    const isJoined = typeof joinCorrelationId !== 'undefined';
    if (isJoined) {
        activationEvent.correlateWithId(joinCorrelationId);
    }
    telemetry_1.Instance.setSettingsContextProperties();
    activationEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.JOIN_DEBUG_SESSION_OPTION, config.get(config.Key.joinDebugSessionOption));
    activationEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.NAME_TAG_VISIBILITY, config.get(config.Key.nameTagVisibility));
    activationEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.EXTENSION_ACTIVATION_INITIAL_INIT_COMPLETE);
    try {
        await util_1.ExtensionUtil.checkCompatibility();
    }
    catch (e) {
        activationEvent.end(telemetry_1.TelemetryResult.UserFailure, 'Extension activation failed - version compatability. ' + e.message);
        // Do not activate the extension if OS version is incompatible
        vscode.window.showErrorMessage(e && e.message);
        return;
    }
    activationEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.EXTENSION_ACTIVATION_COMPAT_CHECK_COMPLETE);
    await util_1.ExtensionUtil.InitAsync(context);
    const liveShareExtension = vscode.extensions.getExtension('ms-vsliveshare.vsliveshare');
    const installationResult = await downloader_1.ExternalDownloader.ensureRuntimeDependenciesAsync(liveShareExtension);
    // failed to install dependecies
    if (installationResult === downloader_1.EnsureRuntimeDependenciesResult.Failure) {
        activationEvent.end(telemetry_1.TelemetryResult.UserFailure, 'Extension activation failed - download runtime dependencies.');
        vscode.window.showErrorMessage(`${config.get(config.Key.name)} was unable to download needed dependencies to finish installation. Ensure you have network connectivity and restart VS Code to retry.`);
        return;
    }
    else if ((installationResult === downloader_1.EnsureRuntimeDependenciesResult.Success) && !abTestsUtil_1.isExtensionBeingUpdated() && isFirstActivation) {
        // show the welcome notificatiton on the first installation
        welcomePageUtil_1.showWelcomeNotification();
    }
    await util_1.ExtensionUtil.updateExecutablePermissionsAsync();
    await launcher_1.Launcher.setup(false, !(await downloader_1.installFileExistsAsync()));
    activationEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.EXTENSION_ACTIVATION_LAUNCHER_SETUP_COMPLETE);
    const rpcClient = new service_1.RPCClient();
    setupRpcFilters(rpcClient);
    Dependencies_1.dependencies.rpcClient = () => rpcClient;
    activationEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.EXTENSION_ACTIVATION_AGENT_PROCESS_SETUP_COMPLETE);
    if (session_1.SessionContext.fileTreeExplorerProvider) {
        session_1.SessionContext.fileTreeExplorerProvider.registerServicesListeners(Dependencies_1.dependencies.serverSharingService(), Dependencies_1.dependencies.portForwardingService(), Dependencies_1.dependencies.terminalService());
    }
    if (session_1.SessionContext.activityBarProvider) {
        session_1.SessionContext.activityBarProvider.registerServicesListeners(Dependencies_1.dependencies.serverSharingService(), Dependencies_1.dependencies.portForwardingService(), Dependencies_1.dependencies.terminalService());
    }
    const hostAdapterService = new hostAdapterService_1.HostAdapterService(rpcClient, Dependencies_1.dependencies.clientAccessCheck);
    const debugManager = new debugManager_1.DebugManager();
    Dependencies_1.dependencies.hostAdapterService = () => hostAdapterService;
    Dependencies_1.dependencies.debugManager = () => debugManager;
    let shareDebugManager = null;
    if (!isJoined) {
        // Note: next line will enforce the dependencies to load the Shared debug manager and so
        // allow late sharing of debug sessions
        shareDebugManager = Dependencies_1.dependencies.shareDebugManager();
    }
    context.subscriptions.push(rpcClient);
    const statusBarController = new statusbar_1.StatusBarController((commandId) => exports.extensionCommands.isCommandEnabled(commandId));
    context.subscriptions.push(statusBarController);
    // TODO: vvvvvvvv Temporary hack till we have fully migrated over to new pattern. vvvvvvvv
    Dependencies_1.dependencies.statusBarController = () => statusBarController;
    // TODO: ^^^^^^^^ Temporary hack till we have fully migrated over to new pattern. ^^^^^^^^
    context.subscriptions.push(RemoteTaskProvider.register());
    context.subscriptions.push(Dependencies_1.dependencies.terminalManager());
    exports.extensionCommands = new commands_1.Commands(shareDebugManager, Dependencies_1.dependencies);
    // Register to receive agent telemetry callbacks.
    Dependencies_1.dependencies.telemetryService().onGenericOperation((e) => telemetry_1.Instance.genericOperation(e.eventName, e.result, e.payload));
    backgroundAgentStartup(rpcClient, statusBarController);
    Dependencies_1.dependencies.fileSystemManager().registerFileSystemProvider();
    const remoteWorkspaceManager = new remoteWorkspaceManager_1.RemoteWorkspaceManager(Dependencies_1.dependencies.workspaceService(), Dependencies_1.dependencies.fileService());
    session_1.SessionContext.SupportSharedTerminals = config_1.featureFlags.sharedTerminals;
    session_1.SessionContext.SupportSummonParticipants = config_1.featureFlags.summonParticipants;
    session_1.SessionContext.EnableVerticalScrolling = config_1.featureFlags.verticalScrolling;
    session_1.SessionContext.serverSharingService = Dependencies_1.dependencies.serverSharingService();
    return new liveShareApi_1.LiveShareExtensionApi(rpcClient, Dependencies_1.dependencies.workspaceService(), Dependencies_1.dependencies.workspaceUserService(), remoteWorkspaceManager, pathManager_1.PathManager.getPathManager());
}
exports.activateInternal = activateInternal;
function setupRpcFilters(rpcClient) {
    const timingFilter = new rpcUtils_1.TimingFilter();
    rpcClient.addReadFilter((msg) => {
        return timingFilter.filter(false, msg);
    });
    rpcClient.addWriteFilter((msg) => {
        return timingFilter.filter(true, msg);
    });
    const telemetryFilter = new rpcTelemetry_1.TelemetryRpcFilter(new rpcTelemetry_1.LanguageServiceRpcMethodNameProvider());
    rpcClient.addReadFilter((msg) => {
        return telemetryFilter.readFilter(msg);
    });
    rpcClient.addWriteFilter((msg) => {
        return telemetryFilter.writeFilter(msg);
    });
    rpcClient.addReadFilter(rpcUtils_1.AddContextToRpcMessage);
}
// this method is called when your extension is deactivated
async function deactivate() {
    let deactivateEvent = telemetry_1.Instance.startTimedEvent(telemetryStrings_1.TelemetryEventNames.DEACTIVATE_EXTENSION);
    try {
        traceSource_1.traceSource.info('Client deactivation requested.');
        // NOTE: vvvvvv Deactive name extension pipeline vvvvvv
        deactivateNew();
        // NOTE: ^^^^^^ Deactive name extension pipeline ^^^^^^
        if (session_1.SessionContext.coeditingClient) {
            session_1.SessionContext.coeditingClient.dispose(); // Also sends accumulated telemetry
        }
        await agent_1.Agent.disposeAsync();
        const workspaceFolder = session_1.SessionContext.extensionContext.workspaceState.get(commands_1.Commands.joinWorkspaceIdFolderSettingName);
        // if inside vsls workspace, delete it
        if (workspaceFolder) {
            try {
                await fs.remove(workspaceFolder);
            }
            catch (e) {
                traceSource_1.traceSource.info(`Failed to remove workspace folder. ${e.message}`);
            }
        }
        launcher_1.Launcher.safelyDeleteCascadeUrlFile();
        deactivateEvent.end(telemetry_1.TelemetryResult.Success, 'Extension deactivation success.');
    }
    catch (e) {
        const telemetryMessage = 'Extension deactivation failed. ' + e.message;
        deactivateEvent.end(telemetry_1.TelemetryResult.Failure, telemetryMessage);
        telemetry_1.Instance.sendDeactivateExtensionFault(telemetry_1.FaultType.Error, telemetryMessage, e, deactivateEvent);
        throw e;
    }
    finally {
        try {
            session_1.SessionContext.dispose();
        }
        catch (e) { } // Drop failures to dispose on the floor
        // Its possible that this will through but not much we can do
        return telemetry_1.Instance.reporter.dispose();
    }
}
exports.deactivate = deactivate;
function activateNew() {
    extensionSetup = Dependencies_1.dependencies.extensionSetup();
    extensionSetup.init();
}
function deactivateNew() {
    if (extensionSetup) {
        extensionSetup.dispose();
    }
}
const backgroundAgentStartup = async (rpcClient, statusBarController) => {
    let activationAgentEvent = telemetry_1.Instance.startTimedEvent(telemetryStrings_1.TelemetryEventNames.ACTIVATE_AGENTASYNC, true);
    try {
        const configurationService = service_1.RpcProxy.create(vsls.ConfigurationService, rpcClient, vsls.TraceSources.ClientRpcAuth);
        const clientVersion = util_1.ExtensionUtil.getVersionInfo();
        const agentVersion = await configurationService.exchangeVersionsAsync(null, clientVersion);
        await configurationService.exchangeSettingsAsync(config.getUserSettings());
        util_1.ExtensionUtil.checkAgentVersion(agentVersion);
        activationAgentEvent.end(telemetry_1.TelemetryResult.Success, 'Agent activation success.');
    }
    catch (e) {
        let errorMessage;
        if (await downloader_1.isInstallCorrupt(traceSource_1.traceSource)) {
            errorMessage = 'An update or installation of VS Live Share failed due to a corrupted download. ' +
                'Please uninstall and reinstall the extension to resolve. ' +
                'See https://aka.ms/vsls-corrupted-install for more details.';
        }
        else {
            errorMessage = e.message;
        }
        const telemetryMessage = 'Agent activation failed. ' + errorMessage;
        activationAgentEvent.end(telemetry_1.TelemetryResult.Failure, telemetryMessage);
        telemetry_1.Instance.sendActivateAgentAsyncFault(telemetry_1.FaultType.Error, telemetryMessage, e, activationAgentEvent);
        statusBarController.dispose();
        vscode.window.showErrorMessage(errorMessage);
        traceSource_1.traceSource.info(`Deactivating extension from background agent startup.`);
        deactivate();
    }
};
const tryToJoinSessionWithInternalSettings = async (workspaceId, activationEvent) => {
    let timeout;
    try {
        activationEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.EXTENSION_ACTIVATION_POST_JOIN, 'True');
        const correlationId = config.get(config.Key.joinEventCorrelationId);
        if (correlationId) {
            activationEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.JOIN_FROM_BROWSER, 'False');
            activationEvent.correlateWithId(correlationId);
        }
        else {
            activationEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.JOIN_FROM_BROWSER, 'True');
        }
        launcher_1.Launcher.safelyDeleteCascadeUrlFile();
        const cancellationTokenSource = new vscode.CancellationTokenSource();
        const cancellationToken = cancellationTokenSource.token;
        /// enable the new `join post reload` command for the team
        if (config.isVSLSTeamMember()) {
            vscode.commands.executeCommand(`${config.get(config.Key.commandPrefix)}.join.postReload`, { workspaceId });
        }
        else {
            await Promise.race([
                util_1.ExtensionUtil.runWithProgress(exports.extensionCommands.onExtensionLoadWithLiveShareWorkspace.bind(exports.extensionCommands, workspaceId, cancellationToken), {
                    title: 'Joining',
                    cancellationToken
                }),
                // silent sign in, fail silently if can't sign in for a long time
                new Promise((resolve, reject) => {
                    timeout = setTimeout(() => {
                        // check if agent started at this point,
                        // if it did - that's just a long join - no need to stop the flow
                        if (!agent_1.Agent.isStarted) {
                            cancellationTokenSource.cancel();
                            session_1.SessionContext.transition(session_1.SessionAction.SignOut);
                            reject(new Error('LiveShare extension failed to initialize.'));
                        }
                    }, AGENT_INIT_JOIN_TIMEOUT);
                })
            ]);
        }
    }
    catch (e) {
        const reload = { title: 'Try again' };
        const result = await util_1.ExtensionUtil.showErrorAsync(e, undefined, [reload]);
        const joinFormBrowserFaultTelemetryEvent = new telemetry_1.Fault(telemetryStrings_1.TelemetryEventNames.JOIN_FROM_BROWSER_FAULT, telemetry_1.FaultType.Error, '', e);
        if (result && (result.title === reload.title)) {
            joinFormBrowserFaultTelemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.RELOAD_POST_TIMEOUT, true);
            joinFormBrowserFaultTelemetryEvent.send();
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
        else {
            joinFormBrowserFaultTelemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.RELOAD_POST_TIMEOUT, false);
            joinFormBrowserFaultTelemetryEvent.send();
            vscode.commands.executeCommand('workbench.action.closeWindow');
        }
    }
    finally {
        clearTimeout(timeout);
    }
};
const tryToJoinWithCascadeFile = async (joinUrl, activationEvent) => {
    activationEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.EXTENSION_ACTIVATION_POST_JOIN, 'False');
    activationEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.JOIN_FROM_BROWSER, 'True');
    activationEvent.send();
    // Called when launched by the protocol handler
    traceSource_1.traceSource.info(`${config.get(config.Key.abbreviation)} started with URL: ${joinUrl}`);
    vscode.commands.executeCommand(`${config.get(config.Key.commandPrefix)}.join`, joinUrl);
};
const tryJoinSession = async (activationEvent) => {
    const settings = vscode.workspace.getConfiguration();
    const workspaceId = settings.get(commands_1.Commands.joinWorkspaceIdSettingName);
    // check if extension has written workspaceId to internal settings file,
    // if so check file modification time, if new, try to join to the session
    if (workspaceId) {
        traceSource_1.traceSource.info(`Found workspaceId: ${workspaceId}`);
        await tryToJoinSessionWithInternalSettings(workspaceId, activationEvent);
    }
    else {
        traceSource_1.traceSource.info(`No workspaceId found in workspace settings.`);
        // check if protocol handler has written collaboration session url to a file,
        // if so try to join to collaboration session
        const joinUrl = await launcher_1.Launcher.readCascadeURL();
        if (joinUrl) {
            traceSource_1.traceSource.info(`Found fresh workspace url cascade.json file: ${joinUrl}`);
            await tryToJoinWithCascadeFile(joinUrl, activationEvent);
        }
        else {
            session_1.SessionContext.notJoining();
            traceSource_1.traceSource.info(`No workspace url found in cascade.json file.`);
            vscode.commands.executeCommand(`${config.get(config.Key.commandPrefix)}.signin`, true);
        }
        activationEvent.send();
    }
};
async function checkIfShowWhatsNewInfo() {
    const whatsNewUri = config.get(config.Key.whatsNewUri);
    if (whatsNewUri) {
        await config.save(config.Key.whatsNewUri, '');
        let result = await vscode.window.showInformationMessage(`VS Live Share updated! ${config.get(config.Key.whatsNewText)}`, `More info`);
        if (result) {
            util_1.ExtensionUtil.openBrowser(whatsNewUri);
        }
        const whatsNewTelemetryEvent = new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.SHOW_WHATS_NEW_INFO);
        whatsNewTelemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.MORE_INFO_CLICKED, result ? true : false);
        whatsNewTelemetryEvent.send();
    }
}

//# sourceMappingURL=extension.js.map
