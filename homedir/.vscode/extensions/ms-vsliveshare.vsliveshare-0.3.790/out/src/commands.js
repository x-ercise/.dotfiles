//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const os = require("os");
const path = require("path");
const url = require("url");
const fse = require("fs-extra");
const uuid4 = require("uuid/v4");
const child_process = require("child_process");
const semver = require("semver");
const traceSource_1 = require("./tracing/traceSource");
const serviceErrors_1 = require("./workspace/serviceErrors");
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const joinDebugManager_1 = require("./debugger/joinDebugManager");
const breakpointManager_1 = require("./debugger/breakpointManager");
const lspServer = require("./languageService/lspServer");
const vsls = require("./contracts/VSLS");
const VSLS_1 = require("./contracts/VSLS");
const launcher_1 = require("./launcher");
const util = require("./util");
const config = require("./config");
const config_1 = require("./config");
const util_1 = require("./util");
const workspaceManager_1 = require("./workspace/workspaceManager");
const session_1 = require("./session");
const sessionTypes_1 = require("./sessionTypes");
const clipboardy_1 = require("clipboardy");
const telemetry_1 = require("./telemetry/telemetry");
const telemetryStrings_1 = require("./telemetry/telemetryStrings");
const portForwardingTelemetry_1 = require("./telemetry/portForwardingTelemetry");
const logZipExporter_1 = require("./tracing/logZipExporter");
const logFileTraceListener_1 = require("./tracing/logFileTraceListener");
const VSLS_2 = require("./contracts/VSLS");
const liveShare_1 = require("./api/liveShare");
const agent_1 = require("./agent");
const WorkspaceTaskClient = require("./tasks/workspaceTaskClient");
const WorkspaceTaskService = require("./tasks/workspaceTaskService");
const coauthoringService_1 = require("./coediting/common/coauthoringService");
const languageServiceTelemetry_1 = require("./telemetry/languageServiceTelemetry");
const searchProvider_1 = require("./workspace/searchProvider");
const joinUtilities_1 = require("./workspace/joinUtilities");
const textSearchService_1 = require("./textSearchService");
const welcomePageUtil_1 = require("./welcomePage/welcomePageUtil");
const ShareCommand_1 = require("./_new_/commands/ShareCommand");
const WorkspaceEnvironmentUtil_1 = require("./_new_/util/WorkspaceEnvironmentUtil");
var SignInPromptUserAction;
(function (SignInPromptUserAction) {
    SignInPromptUserAction[SignInPromptUserAction["Proceed"] = 0] = "Proceed";
    SignInPromptUserAction[SignInPromptUserAction["Cancel"] = 1] = "Cancel";
})(SignInPromptUserAction || (SignInPromptUserAction = {}));
class Commands {
    constructor(shareDebugManager, dependencies) {
        this.shareDebugManager = shareDebugManager;
        this.dependencies = dependencies;
        this.extensionInstanceId = Commands.generateExtensionId();
        // flag to indicate that we have an atctive request to the agent to find a user code from a browser tab title
        this.awaitingForLoginCodeFromAgent = false;
        this.logOutAsync = async () => {
            await this.authService.logoutAsync({ cache: true });
            session_1.SessionContext.transition(session_1.SessionAction.SignOut);
            session_1.SessionContext.userInfo = undefined;
        };
        this.checkForSharedServers = async (event) => {
            try {
                let sharedServers;
                if (session_1.SessionContext.State === sessionTypes_1.SessionState.Joined) {
                    sharedServers = await this.portForwardingService.getSharedServersAsync();
                }
                else if (session_1.SessionContext.State === sessionTypes_1.SessionState.Shared) {
                    sharedServers = await this.serverSharingService.getSharedServersAsync();
                }
                session_1.SessionContext.ServersShared = sharedServers.length > 0;
            }
            catch (e) {
                traceSource_1.traceSource.error('Checking for shared servers failed: ' + e);
            }
        };
        this.removeUserCommandHandler = async (item) => {
            if (!item || (item.sessionId === undefined)) {
                return;
            }
            const { sessionId } = item;
            if (!sessionId || sessionId < 1) {
                return;
            }
            await this.workspaceUserService.removeUserAsync(sessionId);
        };
        this.rpcClient = dependencies.rpcClient();
        this.authService = dependencies.authService();
        this.workspaceService = dependencies.workspaceService();
        this.fileService = dependencies.fileService();
        this.statusBarController = dependencies.statusBarController();
        this.hostAdapterService = dependencies.hostAdapterService();
        this.serverSharingService = dependencies.serverSharingService();
        this.portForwardingService = dependencies.portForwardingService();
        this.sourceEventService = dependencies.sourceEventService();
        this.workspaceUserService = dependencies.workspaceUserService();
        this.firewallService = dependencies.firewallService();
        this.terminalService = dependencies.terminalService();
        this.debuggerHostService = dependencies.debuggerHostService();
        this.workspaceAccessControlManager = dependencies.workspaceAccessControlManager;
        this.accessControlManager = dependencies.accessControlManager;
        this.clientAccessCheck = dependencies.clientAccessCheck;
        this.telemetryService = dependencies.telemetryService();
        this.fileSystemManager = dependencies.fileSystemManager();
        this.workspaceCommandManager = dependencies.workspaceCommandManager();
        this.register();
        this.workspaceService.onConnectionStatusChanged((e) => this.onWorkspaceConnectionStatusChanged(e));
        this.workspaceService.onProgressUpdated((e) => this.onWorkspaceProgressUpdated(e));
        this.workspaceUserService.onWorkspaceSessionChanged((e) => this.onWorkspaceSessionChanged(e));
        this.portForwardingService.onSharingStarted(this.checkForSharedServers);
        this.portForwardingService.onSharingStopped(this.checkForSharedServers);
        this.serverSharingService.onSharingStarted(this.checkForSharedServers);
        this.serverSharingService.onSharingStopped(this.checkForSharedServers);
        this.hostAdapterService.runInTerminal = this.hostAdapterService_RunInTerminal.bind(this);
    }
    static generateExtensionId() {
        return uuid4();
    }
    register() {
        const context = util_1.ExtensionUtil.Context;
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.removeParticipant', this.removeUserCommandHandler, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.removeParticipantFromFileTreeExplorer', this.removeUserCommandHandler, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.removeParticipantFromActivityBar', this.removeUserCommandHandler, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.collaboration.link.copy', this.copyCollaborationLinkCommandHandler, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.collaboration.link.copyFromFileTreeExplorer', this.copyCollaborationLinkCommandHandler, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.collaboration.link.copyFromActivityBar', this.copyCollaborationLinkCommandHandler, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.signin.token', this.signInToken, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.signin', this.startSignInProcess, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.signin.browser', () => this.startSignInProcess(false, false)));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.signout', this.signOut, this));
        if (!config_1.featureFlags.newShareCommand) {
            context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.start', this.startCollaboration, this));
            context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.startFromFileTreeExplorer', this.startCollaboration, this));
            context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.startFromActivityBar', this.startCollaboration, this));
            if (config_1.featureFlags.accessControl) {
                context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.startReadOnly', this.startReadOnlyCollaboration, this));
                context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.startReadOnlyFromFileTreeExplorer', this.startReadOnlyCollaboration, this));
                context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.startReadOnlyFromActivityBar', this.startReadOnlyCollaboration, this));
            }
        }
        // enable the old join commands to all but the team members
        // Note: welcomePageUtils.showWebViewWelcomePage is using the same check (isVSLSTeamMember) to
        // determine what join command options to use. When the old join command is removed or changed
        // this will need to be updated as well.
        if (!config.isVSLSTeamMember()) {
            context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.join', this.joinCollaboration, this));
            context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.joinFromFileTreeExplorer', this.joinCollaboration, this));
            context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.joinFromActivityBar', this.joinCollaboration, this));
        }
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.end', this.endCollaboration, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.endFromFileTreeExplorer', this.endCollaboration, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.endFromActivityBar', this.endCollaboration, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.leave', this.leaveCollaboration, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.leaveFromFileTreeExplorer', this.leaveCollaboration, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.leaveFromActivityBar', this.leaveCollaboration, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.debug', this.debug, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.listSharedServers', this.listSharedServers, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.shareServer', this.shareServer, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.shareServerFromFileTreeExplorer', this.shareServer, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.shareServerFromActivityBar', this.shareServer, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.unshareServer', this.unshareServer, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.unshareServerFromFileTreeExplorer', this.unshareServerBySourcePort, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.unshareServerFromActivityBar', this.unshareServerBySourcePort, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.launcherSetup', () => launcher_1.Launcher.setup(true)));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.exportLogs', this.exportLogsAsync, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.focusParticipants', this.summonParticipants, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.focusParticipantsFromFileTreeExplorer', this.summonParticipants, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.focusParticipantsFromActivityBar', this.summonParticipants, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.openServerInBrowserFromFileTreeExplorer', this.openSharedServerInBrowser, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.openServerInBrowserFromActivityBar', this.openSharedServerInBrowser, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.copyServerURLFromFileTreeExplorer', this.copySharedServerURL, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.copyServerURLFromActivityBar', this.copySharedServerURL, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand(Commands.listParticipantsCommandId, this.listParticipants, this));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.help', () => welcomePageUtil_1.showWelcomePage(welcomePageUtil_1.WelcomePageSource.Help)));
        context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.resetLanguageServices', async () => {
            if (session_1.SessionContext.coeditingClient) {
                session_1.SessionContext.coeditingClient.resetLanguageServicesDataStructures();
                (new telemetry_1.TelemetryEvent(languageServiceTelemetry_1.LanguageServiceTelemetryEventNames.RESET_LANGUAGE_SERVICES)).send();
            }
        }, this));
        if (config.get(config.Key.diagnosticLogging)) {
            util_1.ExtensionUtil.setCommandContext(Commands.logsEnabled, true);
        }
        else {
            util_1.ExtensionUtil.setCommandContext(Commands.logsEnabled, false);
        }
        if (process.env.VSLS_TEST_ENABLE_COMMANDS === '1') {
            context.subscriptions.push(util_1.ExtensionUtil.registerCommand('liveshare.executeCommand', this.executeCommand, this));
        }
    }
    /**
     * Executes an arbitrary VS Code command entered in the input box. Used to workaround UI testing limitations.
     */
    async executeCommand() {
        const commandAndArgs = await vscode.window.showInputBox({
            prompt: 'Enter a command',
            ignoreFocusOut: true,
        });
        if (!commandAndArgs) {
            return;
        }
        const sep = commandAndArgs.indexOf(' ');
        let command = (sep >= 0 ? commandAndArgs.substr(0, sep) : commandAndArgs);
        let args = (sep >= 0 ? JSON.parse(commandAndArgs.substr(sep + 1)) : []);
        if (!Array.isArray(args)) {
            args = [args];
        }
        // Commands expect URI arguments to be parsed as `Uri` objects.
        args = args.map((arg) => (typeof arg === 'string' && arg.startsWith('file://'))
            ? vscode.Uri.file(arg.substr(7)) : arg);
        const delayPrefix = 'delay+';
        if (command.startsWith(delayPrefix)) {
            // Don't await the command directly; execute it later after a delay.
            // This is used with commands that reload or close the window to avoid automation hangs.
            command = command.substr(delayPrefix.length);
            setTimeout(() => vscode.commands.executeCommand(command, ...args), 1000);
        }
        else {
            await vscode.commands.executeCommand(command, ...args);
        }
    }
    // Return when a command is enabled
    isCommandEnabled(commandId) {
        if (commandId === 'liveshare.debug') {
            return session_1.SessionContext.joinDebugManager.getAvailableDebugSessions().length > 0;
        }
        return false;
    }
    async startReadOnlyCollaboration() {
        return await vscode.commands.executeCommand('liveshare.start', { access: liveShare_1.Access.ReadOnly });
    }
    async startCollaboration(options) {
        // if agent did not start on this explicit user action, - show the init error suggesting a reload
        if (!agent_1.Agent.isStarted) {
            await this.showAgentInitErrorOnSignIn();
            return;
        }
        // if sharing already, ignore the request
        if (session_1.SessionContext.State === sessionTypes_1.SessionState.SharingInProgress) {
            return;
        }
        const isSignedOut = (session_1.SessionContext.State === sessionTypes_1.SessionState.SignedOut) || (session_1.SessionContext.State === sessionTypes_1.SessionState.ExternallySigningIn);
        const isEmptyWorkspace = !util_1.PathUtil.getPrimaryWorkspaceFileSystemPath();
        new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.CLICK_SHARE_BUTTON)
            .addProperty('isSignedOut', isSignedOut)
            .addProperty('isEmptyWorkspace', isEmptyWorkspace)
            .send();
        if (isEmptyWorkspace) {
            vscode.window.showInformationMessage('You must open a folder or workspace before you can start a session.');
            return;
        }
        if (util_1.isActiveCancellationTokenSource(this.browserSignInCancellationSource) && this.awaitingForLoginCodeFromAgent) {
            this.browserSignInCancellationSource.cancel();
            this.browserSignInCancellationSource = undefined;
        }
        if (util_1.isActiveCancellationTokenSource(this.shareSignInCancellationSource) && this.awaitingForLoginCodeFromAgent) {
            this.openLoginPage(true);
            return;
        }
        this.shareSignInCancellationSource = new vscode.CancellationTokenSource();
        await this.signIn({
            openLoginPage: true,
            cancellationToken: this.shareSignInCancellationSource.token,
            signInPromptUserActionCallback: async (status) => {
                if (status === SignInPromptUserAction.Cancel) {
                    session_1.SessionContext.transition(session_1.SessionAction.SignOut);
                }
            }
        });
        let showInvitationLink = await util_1.ExtensionUtil
            .runWithProgress(() => this.startCollaborationHelper(true /* retryIfUnauthorized */, options), { title: 'Sharing' });
        if (showInvitationLink && !(options && options.suppressNotification)) {
            this.showInvitationLink();
        }
        const sessionInfo = session_1.SessionContext.workspaceSessionInfo;
        if (sessionInfo) {
            vscode.workspace.saveAll(false);
            return vscode.Uri.parse(sessionInfo.joinUri);
        }
        else {
            traceSource_1.traceSource.info('Share was not successful due to null "SessionContext.workspaceSessionInfo".');
        }
        return null;
    }
    // Returns whether or not invitation link should be shown
    async startCollaborationHelper(retryIfUnauthorized = true, options = null) {
        if (session_1.SessionContext.State === sessionTypes_1.SessionState.Shared) {
            return true;
        }
        else if (session_1.SessionContext.State === sessionTypes_1.SessionState.Joined) {
            throw new Error('Already joined a collaboration session.');
        }
        let shareTelemetryEvent = telemetry_1.Instance.startTimedEvent(telemetryStrings_1.TelemetryEventNames.SHARE_WORKSPACE);
        telemetry_1.Instance.setCorrelationEvent(shareTelemetryEvent);
        const userInfo = await this.signIn();
        if (!userInfo) {
            shareTelemetryEvent.end(telemetry_1.TelemetryResult.IndeterminateFailure, 'Share canceled - sign-in failed or was cancelled.');
            return false;
        }
        shareTelemetryEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.SIGN_IN_COMPLETE);
        let telemetryMessage;
        switch (userInfo.accountStatus) {
            case vsls.UserAccountStatus.Pending:
                telemetryMessage = 'Share failed - account status \'Pending\'.';
                shareTelemetryEvent.end(telemetry_1.TelemetryResult.UserFailure, telemetryMessage);
                telemetry_1.Instance.sendShareFault(telemetry_1.FaultType.User, telemetryMessage, null, shareTelemetryEvent);
                await util_1.ExtensionUtil.showErrorAsync(`You cannot share as you have signed up for the VS Live Share preview but have not yet been accepted.`);
                break;
            case vsls.UserAccountStatus.Transient:
                telemetryMessage = 'Share failed - account status \'Transient\'.';
                shareTelemetryEvent.end(telemetry_1.TelemetryResult.UserFailure, telemetryMessage);
                telemetry_1.Instance.sendShareFault(telemetry_1.FaultType.User, telemetryMessage, null, shareTelemetryEvent);
                const result = await vscode.window.showWarningMessage(`You cannot share as you have not been accepted into the VS Live Share preview. If you haven't, sign up now to be considered for a future preview wave.`, { title: 'Sign Up Now' });
                if (!result)
                    return;
                util_1.ExtensionUtil.openBrowser(config.get(config.Key.registrationUri));
                break;
            default:
                session_1.SessionContext.userInfo = userInfo;
                session_1.SessionContext.transition(session_1.SessionAction.AttemptSharing);
                const workspaceShareInfo = ShareCommand_1.ShareCommandUtilities.getShareInfo({
                    workspaceInfo: new WorkspaceEnvironmentUtil_1.WorkspaceEnvironmentUtil(),
                    connectionMode: config.get(config.Key.connectionMode)
                });
                shareTelemetryEvent.addMeasure(telemetryStrings_1.TelemetryPropertyNames.SHARE_WORKSPACE_COUNT_OF_WORKSPACE_FOLDERS, workspaceShareInfo.rootDirectories.length);
                try {
                    if (!await this.performFirewallCheckAsync()) {
                        session_1.SessionContext.transition(session_1.SessionAction.SharingError);
                        telemetryMessage = 'Share failed. Firewall check failed.';
                        shareTelemetryEvent.end(telemetry_1.TelemetryResult.Failure, telemetryMessage);
                        telemetry_1.Instance.sendShareFault(telemetry_1.FaultType.Error, telemetryMessage, shareTelemetryEvent);
                        await util_1.ExtensionUtil.showErrorAsync(util_1.ExtensionUtil.getString('error.BlockActionShareFailed'), { modal: false });
                        return false;
                    }
                    session_1.SessionContext.workspaceSessionInfo = await this.workspaceService.shareWorkspaceAsync(workspaceShareInfo);
                    // SessionContext.workspaceSessionInfo may be null.
                    // TODO: enable strictNullChecks in tsconfig
                    if (!session_1.SessionContext.workspaceSessionInfo) {
                        throw new Error('Failed to create a collaboration session. An error occurred while sending the request.');
                    }
                    const textSearchService = new textSearchService_1.TextSearchService(this.workspaceService);
                    await textSearchService.initAsync();
                    shareTelemetryEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.SHARE_WORKSPACE_COMPLETE);
                    session_1.SessionContext.initCoEditingContext({
                        sourceEventService: this.sourceEventService,
                        userInfo: userInfo,
                        statusBarController: this.statusBarController,
                        fileSystemService: this.fileService,
                        isExpert: false,
                        clientAccessCheck: this.clientAccessCheck,
                    });
                    await this.workspaceCommandManager.init();
                }
                catch (e) {
                    let httpException = e;
                    if (httpException.code === VSLS_1.ErrorCodes.UnauthorizedHttpStatusCode && retryIfUnauthorized) {
                        // record failure in telemetry
                        telemetryMessage = 'Share failed. User token expired. Retrying.';
                        shareTelemetryEvent.end(telemetry_1.TelemetryResult.Failure, telemetryMessage);
                        telemetry_1.Instance.sendShareFault(telemetry_1.FaultType.User, telemetryMessage, e, shareTelemetryEvent);
                        // kick off the sign in process and try sharing once again
                        let user = await this.signIn({ openLoginPage: true, isSilent: false, clearCache: true });
                        if (!user) {
                            session_1.SessionContext.transition(session_1.SessionAction.SignInError);
                            shareTelemetryEvent.end(telemetry_1.TelemetryResult.Failure, 'Sign-in failed.');
                            return false;
                        }
                        else {
                            // recursive call, don't retry again
                            return await this.startCollaborationHelper(false);
                        }
                    }
                    else {
                        session_1.SessionContext.transition(session_1.SessionAction.SharingError);
                        const unknownError = !session_1.SessionContext.workspaceSessionInfo;
                        telemetryMessage = 'Share failed. ' + util_1.ExtensionUtil.getErrorString(e.code) + ' ' + e.message;
                        shareTelemetryEvent.end(unknownError ? telemetry_1.TelemetryResult.IndeterminateFailure : telemetry_1.TelemetryResult.Failure, telemetryMessage);
                        telemetry_1.Instance.sendShareFault(unknownError ? telemetry_1.FaultType.Unknown : telemetry_1.FaultType.Error, telemetryMessage, e, shareTelemetryEvent);
                        await util_1.ExtensionUtil.showErrorAsync(e);
                        return false;
                    }
                }
                session_1.SessionContext.transition(session_1.SessionAction.SharingSuccess);
                await this.workspaceAccessControlManager().init();
                if (options && options.access === liveShare_1.Access.ReadOnly) {
                    await this.workspaceAccessControlManager().setReadOnly(true);
                }
                // Share debug manager
                if (this.shareDebugManager) {
                    await this.shareDebugManager.setShareState(true);
                }
                await lspServer.activateAsync(this.workspaceService, this.clientAccessCheck);
                // Create breakpoint manager instance
                await this.createBreakpointManager(true);
                await WorkspaceTaskService.enable(this.rpcClient, this.workspaceService, this.clientAccessCheck);
                shareTelemetryEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.INIT_DEBUGGING_COMPLETE);
                shareTelemetryEvent.end(telemetry_1.TelemetryResult.Success, 'Share success.');
                const guestTrackerManager = this.dependencies.guestTrackerManager();
                guestTrackerManager.init();
                return true;
        }
    }
    /// <summary>
    /// Performs firewall rules check for the vsls-agent.exe process.
    /// </summary>
    /// <param name="session">Current client session.</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if sharing operation should continue, false otherwise.</returns>
    async performFirewallCheckAsync() {
        let connectionMode = config.get(config.Key.connectionMode);
        if (vsls.ConnectionMode.Auto === connectionMode ||
            vsls.ConnectionMode.Direct === connectionMode) {
            let firewallStatus = await this.firewallService.getFirewallStatusAsync();
            if (VSLS_2.FirewallStatus.Block === firewallStatus) {
                let message;
                switch (connectionMode) {
                    case vsls.ConnectionMode.Direct:
                        await this.showFirewallInformationMessage('error.BlockActionDirectModePrompt', false);
                        return false;
                    case vsls.ConnectionMode.Auto:
                        if (await this.showFirewallInformationMessage('warning.BlockActionAutoModePrompt', true)) {
                            await config.save(config.Key.connectionMode, vsls.ConnectionMode.Relay, true, true);
                            return true;
                        }
                        return false;
                    default:
                        break;
                }
            }
            else if (VSLS_2.FirewallStatus.None === firewallStatus) {
                let message;
                switch (connectionMode) {
                    case vsls.ConnectionMode.Direct:
                        await this.showFirewallInformationMessage('info.NoneActionDirectModePrompt', false);
                        break;
                    case vsls.ConnectionMode.Auto:
                        await this.showFirewallInformationMessage('info.NoneActionAutoModePrompt', false);
                        break;
                    default:
                        break;
                }
            }
        }
        return true;
    }
    async showFirewallInformationMessage(messageId, showCancelOption) {
        if (config.get(config.Key.suppressFirewallPrompts)) {
            return true;
        }
        const getHelp = 'Help';
        const ok = 'OK';
        let result;
        if (showCancelOption) {
            result = await vscode.window.showInformationMessage(util_1.ExtensionUtil.getString(messageId), { modal: util_1.ExtensionUtil.enableModalNotifications }, ok, getHelp);
        }
        else {
            let getHelpObject = { title: getHelp, isCloseAffordance: false };
            result = await vscode.window.showInformationMessage(util_1.ExtensionUtil.getString(messageId), { modal: util_1.ExtensionUtil.enableModalNotifications }, { title: ok, isCloseAffordance: true }, getHelpObject);
            if (result === getHelpObject) {
                result = getHelp;
            }
            else {
                result = ok;
            }
        }
        if (result === getHelp) {
            this.showFirewallHelp();
            return await this.showFirewallInformationMessage(messageId, showCancelOption);
        }
        else {
            return result === ok;
        }
    }
    showFirewallHelp() {
        const firewallHelpLink = 'https://go.microsoft.com/fwlink/?linkid=869620';
        util_1.ExtensionUtil.openBrowser(firewallHelpLink);
    }
    showSecurityInfo() {
        const securityInfoLink = 'https://aka.ms/vsls-security';
        util_1.ExtensionUtil.openBrowser(securityInfoLink);
    }
    async createBreakpointManager(isSharing) {
        if (breakpointManager_1.BreakpointManager.hasVSCodeSupport()) {
            session_1.SessionContext.breakpointManager = new breakpointManager_1.BreakpointManager(isSharing, this.sourceEventService);
            await session_1.SessionContext.breakpointManager.initialize();
        }
    }
    async showInvitationLink(link) {
        if (!link || link === session_1.SessionContext.workspaceSessionInfo.joinUri) {
            const currentLink = session_1.SessionContext.workspaceSessionInfo.joinUri;
            await clipboardy_1.write(currentLink);
            // If the welcome page has never been displayed on share show it directly.
            const isWelcomePageDisplayed = config.get(config.Key.isWelcomePageDisplayed);
            if (!isWelcomePageDisplayed) {
                await welcomePageUtil_1.showWelcomePage(welcomePageUtil_1.WelcomePageSource.Sharing);
                return;
            }
            const moreInfoButton = { id: 1, title: 'More info' };
            const copyButton = { id: 2, title: 'Copy again' };
            const toggleReadOnlyButton = { id: 3, title: session_1.SessionContext.IsReadOnly ? 'Make read/write' : 'Make read-only' };
            let buttons = [moreInfoButton, copyButton];
            if (config.featureFlags.accessControl) {
                buttons.splice(0, 0, toggleReadOnlyButton);
            }
            const result = await vscode.window.showInformationMessage('Invitation link copied to clipboard! Send it to anyone you trust or click "More info" to learn about secure sharing.', ...buttons);
            if (result && result.id === copyButton.id) {
                // Prevent this button from dismissing the notification.
                await this.showInvitationLink(currentLink);
            }
            else if (result && result.id === moreInfoButton.id) {
                await welcomePageUtil_1.showWelcomePage(welcomePageUtil_1.WelcomePageSource.Sharing);
            }
            else if (result && result.id === toggleReadOnlyButton.id) {
                await this.workspaceAccessControlManager().setReadOnly(!session_1.SessionContext.IsReadOnly);
            }
        }
        else {
            await vscode.window.showErrorMessage('This invite link has expired. Share again to generate a new link.');
        }
    }
    endCollaboration() {
        return util_1.ExtensionUtil.runWithProgress(() => this.endCollaborationHelper(), { title: 'Ending Collaboration Session' });
    }
    async copyCollaborationLinkCommandHandler() {
        if (!session_1.SessionContext || !session_1.SessionContext.workspaceSessionInfo) {
            return;
        }
        const currentLink = session_1.SessionContext.workspaceSessionInfo.joinUri;
        await clipboardy_1.write(currentLink);
        await vscode.window.showInformationMessage('Invite link copied to clipboard! Send it to anyone you trust.');
    }
    async endCollaborationHelper() {
        if (session_1.SessionContext.State !== sessionTypes_1.SessionState.Shared) {
            throw new Error('Not currently hosting a collaboration session.');
        }
        this.workspaceCommandManager.dispose();
        try {
            // Unshare debug Manager
            if (this.shareDebugManager) {
                await this.shareDebugManager.setShareState(false);
            }
        }
        catch (e) {
            traceSource_1.traceSource.error(e);
        }
        if (session_1.SessionContext.breakpointManager) {
            await session_1.SessionContext.breakpointManager.dispose();
        }
        try {
            await lspServer.dispose();
        }
        catch (e) {
            traceSource_1.traceSource.error(e);
        }
        try {
            await WorkspaceTaskService.disable();
        }
        catch (e) {
            traceSource_1.traceSource.error(e);
        }
        try {
            await this.workspaceService.unshareWorkspaceAsync(session_1.SessionContext.workspaceSessionInfo.id);
        }
        catch (e) {
            traceSource_1.traceSource.error(e);
        }
        try {
            this.workspaceAccessControlManager().endCollaboration();
        }
        catch (e) {
            traceSource_1.traceSource.error(e);
        }
        session_1.SessionContext.transition(session_1.SessionAction.EndSharing);
        // TODO: total hack whilst the end share command hasn't been migrated
        const guestTrackerManager = this.dependencies.guestTrackerManager();
        // Don't want to show the guest tracker feedback at the same time we show the general feedback
        if (!guestTrackerManager.shouldShow()) {
            this.getFeedback();
        }
        guestTrackerManager.dispose();
    }
    async getFeedback() {
        const sessionCount = config.get(config.Key.sessionCount);
        await config.save(config.Key.sessionCount, sessionCount + 1);
        const goodResponse = '🙂';
        const badResponse = '☹️';
        const apatheticResponse = 'Don\'t Ask Again';
        const dismissedResponse = 'Dismissed';
        // Request feedback
        if (!config.get(config.Key.dontRequestFeedback) && sessionCount % 5 === 0) {
            let qualitativeFeedback = await vscode.window.showInformationMessage('How was your collaboration session?', goodResponse, badResponse, apatheticResponse);
            if (!qualitativeFeedback) {
                qualitativeFeedback = dismissedResponse;
            }
            switch (qualitativeFeedback) {
                case goodResponse:
                case badResponse:
                    this.promptFeedback();
                    break;
                case apatheticResponse:
                    await config.save(config.Key.dontRequestFeedback, true);
                    break;
                default:
                    break;
            }
            telemetry_1.TelemetryEvent.create(telemetryStrings_1.TelemetryEventNames.FEEDBACK, {
                properties: {
                    qualitativeFeedback
                }
            }).send();
        }
    }
    async promptFeedback() {
        if (config.get(config.Key.dontRequestAdditionalFeedback)) {
            return;
        }
        const twitter = 'Twitter';
        const github = 'GitHub';
        const dontAskAgain = `Don't Ask Again`;
        const promptFeedbackEvent = new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.PROMPT_FEEDBACK);
        promptFeedbackEvent.send();
        let feedbackResponse = await vscode.window.showInformationMessage('Tell us why?', twitter, github, dontAskAgain);
        if (!feedbackResponse) {
            feedbackResponse = 'Dismissed';
        }
        const provideFeedbackEvent = new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.PROVIDE_FEEDBACK);
        provideFeedbackEvent.correlateWith(promptFeedbackEvent);
        provideFeedbackEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.FEEDBACK_PLATFORM, feedbackResponse);
        provideFeedbackEvent.send();
        let feedbackUrl;
        switch (feedbackResponse) {
            case twitter:
                feedbackUrl = 'https://aka.ms/vsls/TwitterFeedback';
                break;
            case github:
                feedbackUrl = 'https://aka.ms/vsls/GitHubFeedback';
                break;
            case dontAskAgain:
                await config.save(config.Key.dontRequestAdditionalFeedback, true);
                return;
            default:
                return;
        }
        util_1.ExtensionUtil.openBrowser(feedbackUrl);
    }
    getLiveshareLinkMatch(joinCollaborationLink = '') {
        return {
            linkMatch: Commands.joinLinkRegex.exec(joinCollaborationLink),
            cascadeMatch: Commands.cascadeLinkRegex.exec(joinCollaborationLink)
        };
    }
    extractLiveshareLink(joinCollaborationLink = '') {
        const { linkMatch, cascadeMatch } = this.getLiveshareLinkMatch(joinCollaborationLink);
        return (linkMatch && linkMatch[0]) || (cascadeMatch && cascadeMatch[0]);
    }
    extractLiveshareWorkspaceId(joinCollaborationLink = '') {
        const { linkMatch, cascadeMatch } = this.getLiveshareLinkMatch(joinCollaborationLink);
        return (linkMatch && linkMatch[1]) || (cascadeMatch && cascadeMatch[1]);
    }
    async getValidWorkspaceFromLink(joinCollaborationLink) {
        const { linkMatch, cascadeMatch } = this.getLiveshareLinkMatch(joinCollaborationLink);
        const liveshareLink = this.extractLiveshareLink(joinCollaborationLink);
        if (!liveshareLink) {
            throw new Error('The specified value isn’t a valid Live Share URL. Please check the link provided by the host and try again.');
        }
        const workspaceId = this.extractLiveshareWorkspaceId(liveshareLink);
        const workspace = await this.workspaceService.getWorkspaceAsync(workspaceId);
        if (!workspace || !workspace.joinUri) {
            // No workspace or joinUri found - handle the error from the caller
            return undefined;
        }
        const { hostname: linkHostname } = url.parse(joinCollaborationLink);
        const { hostname: workspaceHostname } = url.parse(workspace.joinUri);
        if ((linkHostname !== workspaceHostname) && (linkMatch && !cascadeMatch)) {
            throw new Error('The specified hostname isn’t a valid Live Share URL. Please check the link provided by the host and try again.');
        }
        return workspace;
    }
    async joinCollaboration(joinCollaborationLink, options, retryIfUnauthorized = true) {
        let currentStateMessage;
        if (session_1.SessionContext.State === sessionTypes_1.SessionState.Joined) {
            currentStateMessage = 'You have already joined a collaboration session.';
        }
        else if (session_1.SessionContext.State === sessionTypes_1.SessionState.Shared) {
            currentStateMessage = 'You are already hosting a collaboration session.';
        }
        // If the user is already in a collaboration session,
        // give them the option to join another session in a new window.
        // If they close the message box it will abandon the new join collaboration request.
        const isNewWindow = config.get(config.Key.joinInNewWindow) || (options && options.newWindow);
        if (!isNewWindow && currentStateMessage) {
            const joinButton = { id: 1, title: 'Join collaboration session' };
            const result = await vscode.window.showInformationMessage(`${currentStateMessage} Do you want to join another session in a new window?`, joinButton);
            if (!result) {
                return;
            }
            options = options || {};
            options.newWindow = true;
        }
        let withLink = joinCollaborationLink ? 'True' : 'False';
        if (!joinCollaborationLink) {
            let clipboardValue = '';
            try {
                clipboardValue = clipboardy_1.readSync().trim();
            }
            catch (e) {
                // do not pull value from clipboard
            }
            joinCollaborationLink = await vscode.window.showInputBox({
                prompt: 'Enter a link to the workspace to join',
                ignoreFocusOut: true,
                value: this.extractLiveshareLink(clipboardValue)
            });
            if (!joinCollaborationLink) {
                // The user cancelled out of the input dialog.
                return;
            }
        }
        joinCollaborationLink = joinCollaborationLink.toString().trim();
        let joinEvent = telemetry_1.Instance.startTimedEvent(telemetryStrings_1.TelemetryEventNames.JOIN_WORKSPACE);
        joinEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.JOIN_WITH_LINK, withLink);
        telemetry_1.Instance.setCorrelationEvent(joinEvent);
        const userInfo = await this.signIn({ openLoginPage: true });
        if (!userInfo) {
            joinEvent.end(telemetry_1.TelemetryResult.Cancel, 'Join canceled - sign-in failed or was cancelled.');
            // Sign-in failed or was cancelled.
            return;
        }
        joinEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.SIGN_IN_COMPLETE);
        session_1.SessionContext.userInfo = userInfo;
        session_1.SessionContext.transition(session_1.SessionAction.AttemptJoining);
        try {
            let joined = await util_1.ExtensionUtil.runWithProgress(() => this.joinCollaborationHelper(joinCollaborationLink, options, joinEvent), { title: 'Joining' });
            if (!joined) {
                session_1.SessionContext.transition(session_1.SessionAction.JoiningError);
                const telemetryMessage = 'Join user failed - workspace not found.';
                joinEvent.end(telemetry_1.TelemetryResult.IndeterminateFailure, telemetryMessage);
                telemetry_1.Instance.sendJoinFault(telemetry_1.FaultType.Unknown, telemetryMessage, null, joinEvent);
                await util_1.ExtensionUtil.showErrorAsync('Collaboration session not found.');
            }
            else {
                // When joining, we don't actually do the joinining in this context. We
                // wait for the reload (which we have no insight into). This isn't terribly
                // important in the case where we successfully open the folder (Which is
                // most of the time). _However_, if the customer has dirty state in whatever
                // project they already have open, and clicks cancel, we get no notification
                // of that (See https://github.com/Microsoft/vscode-cascade/issues/37).
                // Thus, when they click cancel, if we do nothing we leave the session in a bad
                // state, and they can't attempt to rejoin again. This state transition
                // puts us back into a "signed in" state so they can attempt to rejoin after
                // addressing their dirty state.
                session_1.SessionContext.transition(session_1.SessionAction.JoiningPendingReload);
            }
        }
        catch (e) {
            let httpException = e;
            if (httpException.code === VSLS_1.ErrorCodes.UnauthorizedHttpStatusCode && retryIfUnauthorized) {
                // record failure in telemetry
                const telemetryMessage = 'Join failed. User token expired. Retrying.';
                joinEvent.end(telemetry_1.TelemetryResult.Failure, telemetryMessage);
                telemetry_1.Instance.sendJoinFault(telemetry_1.FaultType.User, telemetryMessage, e, joinEvent);
                // kick off the sign in process and try joining once again
                let user = await this.signIn({ openLoginPage: true, isSilent: false, clearCache: true });
                if (!user) {
                    session_1.SessionContext.transition(session_1.SessionAction.SignInError);
                    joinEvent.end(telemetry_1.TelemetryResult.Failure, 'Sign-in failed.');
                }
                else {
                    // recursive call, don't retry again
                    return await this.joinCollaboration(joinCollaborationLink, options, false);
                }
            }
            else {
                session_1.SessionContext.transition(session_1.SessionAction.JoiningError);
                session_1.SessionContext.notJoining();
                const telemetryMessage = 'Join failed. ' + util_1.ExtensionUtil.getErrorString(e.code) + ' ' + e.message;
                joinEvent.end(telemetry_1.TelemetryResult.Failure, telemetryMessage);
                telemetry_1.Instance.sendJoinFault(telemetry_1.FaultType.Error, telemetryMessage, e, joinEvent);
                await util_1.ExtensionUtil.showErrorAsync(e);
            }
        }
    }
    async joinCollaborationHelper(joinCollaborationLink, options, joinEvent) {
        const workspaceInfo = await this.getValidWorkspaceFromLink(joinCollaborationLink);
        if (!workspaceInfo) {
            return false;
        }
        const isNewWindow = config.get(config.Key.joinInNewWindow) || (options && options.newWindow);
        const isEmptyLiveshareWorkspace = joinUtilities_1.JoinUtilities.isBrokenLiveshareWorkspaceFile(vscode.workspace);
        if (isEmptyLiveshareWorkspace && !isNewWindow) {
            joinUtilities_1.JoinUtilities.restoreLiveshareWorkspaceState(workspaceInfo.id, workspaceInfo.name);
            joinEvent.addProperty('isRestoredWorkspace', true);
            joinEvent.end(telemetry_1.TelemetryResult.Success);
            return true;
        }
        joinEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.GET_WORKSPACE_COMPLETE);
        let workspaceFolder = path.join(os.tmpdir(), `tmp-${workspaceInfo.id}`);
        if (isNewWindow) {
            workspaceFolder += `_${Date.now()}`;
        }
        try {
            await fse.ensureDir(workspaceFolder);
        }
        catch (e) {
            const telemetryMessage = 'Join failed on workspace folder creation ' + e.code;
            telemetry_1.Instance.sendJoinFault(telemetry_1.FaultType.Error, telemetryMessage, e);
            throw e;
        }
        const workspaceFilePath = path.join(workspaceFolder, `${config.get(config.Key.name)}.code-workspace`);
        const workspaceDefinition = new workspaceManager_1.WorkspaceDefinition();
        let firstRootPath = `${config.get(config.Key.scheme)}:/`;
        const cascadeFolder = { 'uri': firstRootPath, name: (workspaceInfo.name || 'Loading file tree...') };
        workspaceDefinition.folders.push(cascadeFolder);
        workspaceDefinition.settings = {
            [Commands.joinWorkspaceIdSettingName]: workspaceInfo.id,
            [Commands.joinWorkspaceIdFolderSettingName]: workspaceFolder,
            ['files.hotExit']: 'off'
        };
        await workspaceManager_1.WorkspaceManager.createWorkspace(workspaceFilePath, workspaceDefinition);
        await config.save(config.Key.joinWorkspaceLocalPath, workspaceFilePath, true, true);
        await config.save(config.Key.joinEventCorrelationId, joinEvent.getCorrelationId(), true, true);
        await config.save(config.Key.workspaceReloadTime, Date.now(), true);
        const workspaceUri = vscode.Uri.file(workspaceFilePath);
        joinEvent.end(telemetry_1.TelemetryResult.Success);
        // Reloads the workpace
        await util_1.ExtensionUtil.delayIfAutomating();
        vscode.commands.executeCommand('vscode.openFolder', workspaceUri, isNewWindow);
        return true;
    }
    async onExtensionLoadWithLiveShareWorkspace(workspaceId, cancellationToken, progress) {
        if (cancellationToken && cancellationToken.isCancellationRequested) {
            return;
        }
        this.reloadEvent = telemetry_1.Instance.startTimedEvent(telemetryStrings_1.TelemetryEventNames.WORKSPACE_RELOAD);
        telemetry_1.Instance.setCorrelationEvent(this.reloadEvent);
        const correlationId = config.get(config.Key.joinEventCorrelationId);
        if (correlationId) {
            this.reloadEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.JOIN_FROM_BROWSER, 'False');
            this.reloadEvent.correlateWithId(correlationId);
            this.reloadEvent.addMeasure(telemetryStrings_1.TelemetryPropertyNames.RELOAD_START_TIME, config.get(config.Key.workspaceReloadTime));
            this.reloadEvent.addMeasure(telemetryStrings_1.TelemetryPropertyNames.RELOAD_RESUMED_TIME, (new Date()).getTime());
        }
        else {
            this.reloadEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.JOIN_FROM_BROWSER, 'True');
        }
        this.joinProgress = progress;
        // On extension unload, delete the temporary workspace file
        const currentWorkspacePath = config.get(config.Key.joinWorkspaceLocalPath);
        util.ExtensionUtil.disposeOnUnload([currentWorkspacePath]);
        vscode.commands.executeCommand('vscode.removeFromRecentlyOpened', currentWorkspacePath)
            .then(() => { }, () => { });
        // Clear things stashed during reload.
        await config.save(config.Key.joinWorkspaceLocalPath, undefined, true, true);
        await config.save(config.Key.joinEventCorrelationId, undefined, true, true);
        await config.save(config.Key.workspaceReloadTime, undefined, true);
        let unauthorized = false;
        let unauthorizedRetryCount = 1;
        do {
            const userInfo = await this.signIn({
                cancellationToken,
                clearCache: unauthorized,
                openLoginPage: true,
                signInPromptUserActionCallback: async (status) => {
                    if (status === SignInPromptUserAction.Cancel) {
                        const signInAgainItem = { title: 'Launch Sign In' };
                        const result = await vscode.window.showWarningMessage('You need to sign in before joining the collaboration session.', signInAgainItem);
                        if (result && (result.title === signInAgainItem.title)) {
                            session_1.SessionContext.transition(session_1.SessionAction.AwaitExternalSignIn);
                            this.startSignInProcess(false, false);
                        }
                        else {
                            this.reloadEvent.end(telemetry_1.TelemetryResult.Cancel, 'Sign-in was cancelled.');
                            vscode.commands.executeCommand('workbench.action.closeFolder');
                        }
                    }
                }
            });
            if (!userInfo) {
                session_1.SessionContext.transition(session_1.SessionAction.SignInError);
                this.reloadEvent.end(telemetry_1.TelemetryResult.Failure, 'Sign-in failed.');
                return;
            }
            this.reloadEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.SIGN_IN_COMPLETE);
            const prevState = session_1.SessionContext.State;
            session_1.SessionContext.userInfo = userInfo;
            session_1.SessionContext.transition(session_1.SessionAction.AttemptJoining);
            const workspaceJoinInfo = {
                id: workspaceId,
                connectionMode: config.get(config.Key.connectionMode),
                clientCapabilities: config.getClientCapabilties(),
            };
            await joinUtilities_1.JoinUtilities.applyGuestSettingsToWorkspace();
            try {
                session_1.SessionContext.workspaceSessionInfo = await this.workspaceService.joinWorkspaceAsync(workspaceJoinInfo, cancellationToken);
                // Ensure that the state of the workspace & access manager is stable, before we
                // try to  add folders -- adding folders implicitly changes the workspace, and there
                // appears to be a race inside VSCode that causes the addition of folders to fail
                // if a configuration setting change is interleaved with updateWorkspaceFolders calls.
                await this.accessControlManager().init();
                joinUtilities_1.JoinUtilities.addAdditionalRootsFromFileServiceToWorkspace(this.fileService, session_1.SessionContext.workspaceSessionInfo);
                this.reloadEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.CREATED_AT, session_1.SessionContext.workspaceSessionInfo.createdAt);
                this.reloadEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.UPDATED_AT, session_1.SessionContext.workspaceSessionInfo.updatedAt);
                this.reloadEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.JOIN_WORKSPACE_COMPLETE);
                await session_1.SessionContext.initCoEditingContext({
                    sourceEventService: this.sourceEventService,
                    userInfo: userInfo,
                    statusBarController: this.statusBarController,
                    fileSystemService: this.fileService,
                    isExpert: true,
                    clientAccessCheck: this.clientAccessCheck,
                });
                await this.workspaceCommandManager.init();
                this.reloadEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.CONNECTION_MODE_USED, session_1.SessionContext.workspaceSessionInfo.connectionMode);
                this.reloadEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.INIT_COEDITING_COMPLETE);
            }
            catch (e) {
                session_1.SessionContext.transition(session_1.SessionAction.JoiningError);
                session_1.SessionContext.notJoining();
                const telemetryMessage = 'Join failed post reload. ' + e.message;
                switch (e.code) {
                    case VSLS_1.ErrorCodes.CollaborationSessionGuestRejected: {
                        this.reloadEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.REJECTED_BY_HOST, true);
                        this.reloadEvent.end(telemetry_1.TelemetryResult.UserFailure, telemetryMessage);
                        break;
                    }
                    case VSLS_1.ErrorCodes.CollaborationSessionGuestCanceled: {
                        this.reloadEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.GUEST_CANCELED, true);
                        this.reloadEvent.end(telemetry_1.TelemetryResult.UserFailure, telemetryMessage);
                        break;
                    }
                    case VSLS_1.ErrorCodes.CollaborationSessionRequestTimedOut: {
                        this.reloadEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.JOIN_REQUEST_TIMED_OUT, true);
                        this.reloadEvent.end(telemetry_1.TelemetryResult.UserFailure, telemetryMessage);
                        break;
                    }
                    case VSLS_1.ErrorCodes.CollaborationSessionNotFound: {
                        this.reloadEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.WORKSPACE_NOT_FOUND, true);
                        this.reloadEvent.end(telemetry_1.TelemetryResult.UserFailure, telemetryMessage);
                        break;
                    }
                    case VSLS_1.ErrorCodes.UnauthorizedHttpStatusCode: {
                        this.reloadEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.UNAUTHORIZED, true);
                        unauthorized = true;
                        if (unauthorizedRetryCount <= 0) {
                            this.reloadEvent.end(telemetry_1.TelemetryResult.UserFailure, telemetryMessage);
                        }
                        break;
                    }
                    default: {
                        this.reloadEvent.end(telemetry_1.TelemetryResult.Failure, telemetryMessage);
                        telemetry_1.Instance.sendJoinFault(telemetry_1.FaultType.Error, telemetryMessage, e, this.reloadEvent);
                        break;
                    }
                }
                if (!unauthorized || unauthorizedRetryCount <= 0) {
                    // if not retrying
                    await util_1.ExtensionUtil.showErrorAsync(e);
                    vscode.commands.executeCommand('workbench.action.closeFolder');
                    return;
                }
            }
        } while (unauthorized && unauthorizedRetryCount-- > 0);
        session_1.SessionContext.transition(session_1.SessionAction.JoiningSuccess);
        session_1.SessionContext.joined();
        if (config.featureFlags.findFiles &&
            semver.gte(semver.coerce(vscode.version), '1.26.0') &&
            vscode.workspace.registerTextSearchProvider &&
            vscode.workspace.registerFileIndexProvider) {
            const provider = new searchProvider_1.SearchProvider(this.fileService);
            util_1.ExtensionUtil.Context.subscriptions.push(vscode.workspace.registerTextSearchProvider(config.get(config.Key.authority), provider));
            util_1.ExtensionUtil.Context.subscriptions.push(vscode.workspace.registerFileIndexProvider(config.get(config.Key.authority), provider));
        }
        // Create debugger manager instances
        session_1.SessionContext.joinDebugManager = new joinDebugManager_1.JoinDebugManager(this.rpcClient, session_1.SessionContext.workspaceSessionInfo.id, this.fileSystemManager.workspaceProvider, this.debuggerHostService, this.hostAdapterService);
        await session_1.SessionContext.joinDebugManager.initialize();
        // Create breakpoint manager
        await this.createBreakpointManager(false);
        await WorkspaceTaskClient.enable(this.rpcClient);
        this.reloadEvent.addMeasure(telemetryStrings_1.TelemetryPropertyNames.RELOAD_END_TIME, (new Date()).getTime());
        this.reloadEvent.end(telemetry_1.TelemetryResult.Success);
    }
    async safelyExecute(name, func) {
        if (!func) {
            return;
        }
        try {
            await func();
        }
        catch (err) {
            traceSource_1.traceSource.error(`Disposal of [${name}] failed: ${err.message}`);
            telemetry_1.Instance.sendFault(telemetryStrings_1.TelemetryEventNames.LEAVE_COLLABORATION_FAIL, telemetry_1.FaultType.NonBlockingFault, `[${name}]: ${err.message}`, err);
        }
    }
    async leaveCollaboration(options = {}) {
        const { skipUnjoin, initiatedRemotely, beforeLeave = (() => { }) // no-op callback
         } = options;
        session_1.SessionContext.coeditingClient.pauseProcessingFileSaveRequests();
        // Force a save of all files to prevent VS Code from popping up the "Save before closing?" dialog. Note that
        // the client is already disposed by now, so this will not send save requests. This needs to happen before
        // leaving the workspace, because saveAll() goes through the file service to check whether the files exist.
        // Save all the documents that are open (Excluding untitled)
        // Untitled will always prompt and are user cancellable, so want to ensure
        // that all the non-untitled are saved first.
        let didSaveUntitled = true;
        const workspaceId = session_1.SessionContext.workspaceSessionInfo.id;
        try {
            if (!skipUnjoin) {
                await this.safelyExecute('Unjoin the workspace', async () => {
                    await this.workspaceService.unjoinWorkspaceAsync(workspaceId);
                });
            }
            // beacause we can have some pending requests to the host side and
            // since they can block the workspace provider which results in hanging `vscode.workspace.saveAll` call,
            // we need to dispose the connection to reset all pending request promises to proceed with `saveAll`
            await this.rpcClient.dispose(new serviceErrors_1.RpcConnectionShutdownError());
            // dispose workspace provider so there are no errors on save
            // Workaround for VSCode bug #53257 where saving files from read-only workspace fails.
            if (session_1.SessionContext.IsReadOnly) {
                await this.fileSystemManager.registerFileSystemProvider(false /* isReadOnly */);
            }
            this.fileSystemManager.disposeWorkspaceProvider();
            await vscode.workspace.saveAll(false);
            didSaveUntitled = await vscode.workspace.saveAll(true);
        }
        catch (e) {
            // Save all can thow if the file system throws errors; rather than
            // crash & fail to leave, lets trace it, but hope that VSCode handles
            // the workspace close more convincingingly. Note, that in the one
            // scenario this happened at the time of writing, e was null.
            traceSource_1.traceSource.error(`Unable to save workspace files: ${e}`);
        }
        // If we still have untitled documents after saving everything, the user likely
        // clicked cancel. If we we're leaving because of something we've done locally
        // (e.g. initiated by the user), we can notice the cancel, and leave them
        // in the session, rather than leaving anyway.
        if (!didSaveUntitled && !initiatedRemotely) {
            session_1.SessionContext.coeditingClient.resumeProcessingFileSaveRequests();
            return false;
        }
        await this.safelyExecute('JoinDebugManager', (session_1.SessionContext.joinDebugManager && session_1.SessionContext.joinDebugManager.dispose));
        await this.safelyExecute('BreakpointManager', (session_1.SessionContext.breakpointManager && session_1.SessionContext.breakpointManager.dispose));
        await this.safelyExecute('WorkspaceTaskClient', WorkspaceTaskClient.disable);
        if (session_1.SessionContext.State === sessionTypes_1.SessionState.Shared) {
            // TODO: Support leaving a shared session without unsharing.
            await this.endCollaboration();
            return;
        }
        else if (session_1.SessionContext.State !== sessionTypes_1.SessionState.Joined) {
            throw new Error('Not currently in a collaboration session.');
        }
        await this.safelyExecute('Move to unjoin state', () => {
            session_1.SessionContext.transition(session_1.SessionAction.Unjoin);
        });
        await this.safelyExecute('Disable collaborator commands', () => this.workspaceCommandManager.dispose());
        await this.safelyExecute('Execute `beforeLeave`', beforeLeave);
        if (!didSaveUntitled) {
            // When we (successfully) connect to a workspace as a guest, using a
            // workspace file, clear the workspace ID from the settings file so
            // that if the workspace reloads, we don't try to reconnect. This
            // happens in two scenarios:
            // - When debugging the extension, and you stop the debugger
            // - When the customer leaves a session (by choice, or removal), but
            //   has untitled files that they haven't yet saved, so we can remove
            //   the folder from the workspace and shut the session down without
            //   loosing the customers data.
            const settings = vscode.workspace.getConfiguration();
            await settings.update(Commands.joinWorkspaceIdSettingName, undefined, vscode.ConfigurationTarget.Workspace);
            await session_1.SessionContext.extensionContext.workspaceState.update(Commands.joinWorkspaceIdSettingName, undefined);
            const currentFolderCount = vscode.workspace.workspaceFolders.reduce((currentValue, folder) => {
                if (folder.uri.scheme !== config.get(config.Key.scheme)) {
                    return currentValue;
                }
                return currentValue + 1;
            }, 0);
            vscode.workspace.updateWorkspaceFolders(0, currentFolderCount); // TODO: multiroot should likely remove all folders
        }
        else {
            await util_1.ExtensionUtil.delayIfAutomating();
            await vscode.commands.executeCommand('workbench.action.closeFolder');
        }
        return true;
    }
    async signInToken() {
        if (session_1.SessionContext.IsSignedIn) {
            // Already signed in.
            vscode.window.showInformationMessage('You are already signed in.');
            return;
        }
        this.disposeLoginCodeListener();
        let userCode = await vscode.window.showInputBox({
            prompt: 'Please enter your user code',
            ignoreFocusOut: true,
        });
        if (!userCode) {
            session_1.SessionContext.transition(session_1.SessionAction.SignInError);
            return;
        }
        // if agent did not start on this explicit user action, - show the init error suggesting a reload
        if (!agent_1.Agent.isStarted) {
            await this.showAgentInitErrorOnSignIn();
            return;
        }
        return this.signIn({ isSilent: false, userCode });
    }
    async showAgentInitErrorOnSignIn() {
        const reload = { title: 'Reload' };
        const signInFailedEvent = new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.AGENT_INIT_SIGN_IN_ATTEMPT_FAULT).send();
        const result = await util_1.ExtensionUtil.showErrorAsync('Live Share extension failed to initialize, try to reload the VSCode window and try again.', undefined, [reload]);
        const signInFailedEventUserAction = new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.USER_ACTION_AGENT_INIT_SIGN_IN_ATTEMPT_FAULT);
        // clicked the reload button, reload the current window
        if (result && (result.title === reload.title)) {
            signInFailedEventUserAction.addProperty(telemetryStrings_1.TelemetryPropertyNames.RELOAD_POST_TIMEOUT, true);
            signInFailedEventUserAction.send();
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
        else {
            signInFailedEventUserAction.addProperty(telemetryStrings_1.TelemetryPropertyNames.RELOAD_POST_TIMEOUT, false);
            signInFailedEventUserAction.send();
        }
    }
    async startSignInProcess(isSilent, prompt = true) {
        if (!isSilent) {
            // if agent did not start on this explicit user action, - show the init error suggesting a reload
            if (!agent_1.Agent.isStarted) {
                await this.showAgentInitErrorOnSignIn();
                return;
            }
            await this.openLoginPage(prompt);
        }
        // did the user click the `sign in` button in the status bar
        const isBrowserSignIn = (isSilent === false) && (prompt === false);
        // are we already making the find user code request to the agent
        const isAlreadyWaitingForAgent = (isBrowserSignIn && this.awaitingForLoginCodeFromAgent);
        // if we already trying to extenally sign in, note that it is not always the same as the `isAlreadyWaitingForAgent` flag
        // as user can:
        //  - click `sign in`
        //  - try to sign in with user code and fail
        //  - this will reset the user status state machine to `signed out` but we will still have the active request
        //    to the agent to find the user code. in this case, if we will try to do the second request to the agent,
        //    it will return the user code twice, but the user code is valid only once which will result in sign in error
        const isCurrentlyExternallySigningIn = (session_1.SessionContext.State === sessionTypes_1.SessionState.ExternallySigningIn);
        const isShareSignInActive = util_1.isActiveCancellationTokenSource(this.shareSignInCancellationSource);
        // Only initiate the external sign-in listener if not already attempting to sign in
        // and there is no "find user code" request to the agent
        // or we attempt to sign in from share button, in this case we will want to cancel the sahre request in case of browser sign in
        if ((!isCurrentlyExternallySigningIn && !isAlreadyWaitingForAgent) || isShareSignInActive) {
            let cancellationToken;
            if (isBrowserSignIn) {
                this.browserSignInCancellationSource = new vscode.CancellationTokenSource();
                cancellationToken = this.browserSignInCancellationSource.token;
                if (isShareSignInActive) {
                    this.shareSignInCancellationSource.cancel();
                }
            }
            let timeout;
            // race signIn with the initialization timeout promise, which ever resolves first
            const result = await Promise.race([
                // silent sign in, fail silently if can't sign in for a long time
                this.signIn({ isSilent, cancellationToken }),
                // if silent sign in - add the init timeout promise,
                // if not, add the "never" one
                (isSilent)
                    ? new Promise((resolve) => {
                        timeout = setTimeout(() => {
                            session_1.SessionContext.transition(session_1.SessionAction.SignOut);
                            new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.SILENT_SIGNIN_TIMEOUT).send();
                            resolve();
                        }, Commands.INIT_SIGN_IN_TIMEOUT);
                    })
                    : new Promise(() => undefined)
            ]);
            clearTimeout(timeout);
            return result;
        }
    }
    async signIn(options = {}) {
        const { isSilent = false, userCode = '', clearCache = false, cancellationToken } = options;
        if (cancellationToken && cancellationToken.isCancellationRequested) {
            return;
        }
        if (session_1.SessionContext.IsSignedIn && !clearCache) {
            // Already signed in.
            return session_1.SessionContext.userInfo;
        }
        let signInEvent = new telemetry_1.TimedEvent(telemetryStrings_1.TelemetryEventNames.SIGN_IN, true);
        signInEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.SILENT_SIGN_IN, isSilent ? 'True' : 'False');
        signInEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.SIGN_IN_WITH_CODE, userCode ? 'True' : 'False');
        try {
            session_1.SessionContext.transition(session_1.SessionAction.AttemptSignIn);
            let userInfo = await this.signInHelper(options, signInEvent);
            if (userInfo) {
                telemetry_1.Instance.setUserInfo(userInfo);
                session_1.SessionContext.userInfo = userInfo;
                session_1.SessionContext.transition(session_1.SessionAction.SignInSuccess);
                signInEvent.end(telemetry_1.TelemetryResult.Success, 'Sign-in success');
            }
            else {
                session_1.SessionContext.transition(session_1.SessionAction.SignInError);
                //Intentionally abandon the signInEvent here. I.e. don't send it.
                //This branch is hit when we try to sign in with a cached auth token
                //on initialization and don't have one. Not interested in receiving
                //telemetry for this case.
            }
            return userInfo;
        }
        catch (e) {
            // ignore cancellation error
            if (e.code === vscode_jsonrpc_1.ErrorCodes.RequestCancelled) {
                return;
            }
            signInEvent.end(telemetry_1.TelemetryResult.IndeterminateFailure, 'Sign-in failed.');
            telemetry_1.Instance.sendSignInFault(telemetry_1.FaultType.Unknown, 'Sign-in failed. ' + e.message, e);
            session_1.SessionContext.transition(session_1.SessionAction.SignInError);
            throw e;
        }
    }
    // Opens the login page as an isolated side-effect
    async openLoginPage(prompt = true, userActionCallback, signInEvent, cancellationToken) {
        const loginPage = await this.authService.getLoginUriAsync(cancellationToken);
        if (cancellationToken && cancellationToken.isCancellationRequested) {
            return;
        }
        if (prompt) {
            const result = await vscode.window.showInformationMessage(`Sign in to ${config.get(config.Key.name)} using a web browser.`, undefined, { title: 'Launch Sign In' });
            if (result) {
                // Find login code, only if not already attempting to do so
                session_1.SessionContext.transition(session_1.SessionAction.AwaitExternalSignIn);
            }
            if (userActionCallback) {
                const notificationResult = result
                    ? SignInPromptUserAction.Proceed
                    : SignInPromptUserAction.Cancel;
                userActionCallback(notificationResult);
            }
            if (!result)
                return;
        }
        util_1.ExtensionUtil.openBrowser(`${loginPage}?extensionId=${this.extensionInstanceId}`);
        return;
    }
    static getAuthTokenPayload(userCode) {
        // check if `code` or `token`
        return (Commands.userCodeRegex.test(userCode))
            ? { code: userCode }
            : { token: userCode };
    }
    async signInHelper(options, signInEvent) {
        const { openLoginPage = false, signInPromptUserActionCallback, clearCache, cancellationToken } = options;
        let { isSilent = false, userCode = '' } = options;
        let progressText = 'Signing in';
        if (cancellationToken && cancellationToken.isCancellationRequested) {
            return;
        }
        userCode = userCode.trim();
        // logging in with user provided code
        if (userCode) {
            return await this.signInWithProgress(Commands.getAuthTokenPayload(userCode), true, progressText, isSilent, cancellationToken);
        }
        let userInfo;
        if (!clearCache) {
            // Try to silently log in with cached credentials
            userInfo = await this.signInWithProgress(null, false, progressText, isSilent, cancellationToken);
        }
        else {
            // Sign out to clear the cache, then continue signing in
            await this.authService.logoutAsync({ cache: true, cacheDefault: true });
        }
        if (!userInfo) {
            if (isSilent) {
                // Silent sign-in failed, and interactive sign-in was not requested.
                session_1.SessionContext.transition(session_1.SessionAction.SignOut);
                // Find login code, only if not already attempting to do so
            }
            else if (session_1.SessionContext.State !== sessionTypes_1.SessionState.ExternallySigningIn) {
                let loginCode = null;
                if (openLoginPage) {
                    await this.openLoginPage(true, signInPromptUserActionCallback, signInEvent, cancellationToken);
                }
                else {
                    session_1.SessionContext.transition(session_1.SessionAction.AwaitExternalSignIn);
                }
                // if trying to extarnally sign in, report it to telemetry
                const isExternallySigningIn = (session_1.SessionContext.State === sessionTypes_1.SessionState.ExternallySigningIn);
                if (isExternallySigningIn && signInEvent) {
                    signInEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.SIGN_IN_WITH_BROWSER, 'True');
                }
                loginCode = await this.findLoginCodeAsync(this.extensionInstanceId, cancellationToken);
                if (this.browserSignInCancellationSource && this.browserSignInCancellationSource.token.isCancellationRequested) {
                    return;
                }
                if (!loginCode) {
                    session_1.SessionContext.transition(session_1.SessionAction.SignOut);
                    return null;
                }
                session_1.SessionContext.transition(session_1.SessionAction.AttemptSignIn);
                userInfo = await this.signInWithProgress({ code: loginCode }, true, progressText, isSilent, cancellationToken);
            }
        }
        return userInfo;
    }
    async findLoginCodeAsync(extensionInstanceId, cancellationToken) {
        switch (os.platform()) {
            case util.OSPlatform.LINUX:
                return await this.findLoginCodeForLinuxAsync(extensionInstanceId);
            case util.OSPlatform.MACOS:
            case util.OSPlatform.WINDOWS:
            default: {
                // due to single-thread async js engine, the `await this.authService.findLoginCodeAsync`
                // function can return twice if we do the request twice. since our user codes are valid only once,
                // this results in a successful sign in with subsequent sign in error because the second attempt will fail.
                // since we cannot cancel a promise nor have semantics to return a special code value to parent function,
                // the solution is to not bother agent with the second "find user code" request if the first one is still active.
                // the `awaitingForLoginCodeFromAgent` flag is the indicator that we have already an active request to the agent.
                try {
                    this.awaitingForLoginCodeFromAgent = true;
                    return await this.authService.findLoginCodeAsync(this.extensionInstanceId, cancellationToken);
                }
                catch (e) {
                    throw e;
                }
                finally {
                    this.awaitingForLoginCodeFromAgent = false;
                }
            }
        }
    }
    async findLoginCodeForLinuxAsync(extensionInstanceId) {
        if (this.findLoginCodePromise) {
            return this.findLoginCodePromise;
        }
        this.findLoginCodePromise = new Promise((resolve, reject) => {
            this.findLoginCodeInterval = setInterval(() => {
                child_process.exec(`xprop -id $(xprop -root 32x '\t$0' _NET_ACTIVE_WINDOW | cut -f 2) WM_NAME`, async (err, stdout, stderr) => {
                    if (err || stderr) {
                        // xprop not supported in this Linux distro
                        traceSource_1.traceSource.error(err ? err.message : stderr);
                        this.disposeLoginCodeListener();
                        const userCode = await vscode.window.showInputBox({
                            prompt: 'Sign in via the external browser, then paste the user code here.',
                            ignoreFocusOut: true,
                        });
                        return resolve(userCode);
                    }
                    const match = stdout.match(Commands.userCodeWithExtensionIdRegex);
                    if (match && match.length >= 3) {
                        const [_, userCode, extensionId] = match;
                        if (extensionId === this.extensionInstanceId) {
                            this.disposeLoginCodeListener();
                            return resolve(userCode);
                        }
                    }
                });
            }, 500);
        });
        return this.findLoginCodePromise;
    }
    disposeLoginCodeListener() {
        if (this.findLoginCodeInterval !== undefined) {
            clearInterval(this.findLoginCodeInterval);
        }
        delete this.findLoginCodePromise;
    }
    async initializeTelemetryAsync() {
        const telemetrySettings = await this.telemetryService.initializeAsync({
            canCollectPII: config.get(config.Key.canCollectPII),
        });
        traceSource_1.Privacy.setKey(telemetrySettings.privacyKey);
    }
    signInWithProgress(token, displayErrors, title, isSilent = true, cancellationToken) {
        const options = {
            title,
            isUserInitiated: !isSilent,
            cancellationToken
        };
        return util_1.ExtensionUtil.runWithProgress(async () => {
            try {
                session_1.SessionContext.transition(session_1.SessionAction.AttemptSignIn);
                // Initialize privacy settings before doing anything with user data.
                await this.initializeTelemetryAsync();
                const userInfo = token
                    ? await this.authService.loginAsync(token, {
                        cache: true,
                        cacheDefault: true
                    }, cancellationToken)
                    : await this.authService.loginWithCachedTokenAsync({
                        accountId: config.get(config.Key.account),
                        providerName: config.get(config.Key.accountProvider),
                    }, undefined, cancellationToken);
                if (!userInfo && displayErrors) {
                    session_1.SessionContext.transition(session_1.SessionAction.SignInError);
                    if (isSilent) {
                        await util_1.ExtensionUtil.showErrorAsync('Sign-in failed.');
                    }
                    else {
                        const signInAgainItem = { title: 'Sign in again' };
                        const result = await util_1.ExtensionUtil.showErrorAsync('The user code is invalid or expired. Try signing in again.', undefined, [
                            signInAgainItem
                        ]);
                        if (result && result.title === signInAgainItem.title) {
                            this.startSignInProcess(false, false);
                        }
                    }
                }
                return userInfo;
            }
            catch (error) {
                // This error message should not be tied to a displayErrors since it indicates
                // missing dependency for Linux
                let { message } = error;
                if (os.platform() === util_1.OSPlatform.LINUX && message && message.includes('org.freedesktop.secrets')) {
                    await util_1.ExtensionUtil.promptLinuxDependencyInstall('VS Live Share could not sign you in due to a missing or misconfigured keyring.');
                }
                else if (displayErrors) {
                    session_1.SessionContext.transition(session_1.SessionAction.SignInError);
                    if (error.code === VSLS_1.ErrorCodes.KeychainAccessFailed) {
                        const moreInfoItem = { title: 'More Info' };
                        const result = await vscode.window.showErrorMessage(util_1.ExtensionUtil.getErrorString(VSLS_1.ErrorCodes.KeychainAccessFailed), { modal: util_1.ExtensionUtil.enableModalNotifications }, moreInfoItem);
                        if (result && result.title === moreInfoItem.title) {
                            util_1.ExtensionUtil.openBrowser('https://support.apple.com/en-us/HT201609');
                        }
                    }
                    else if (typeof error === 'string' && error.includes('secret_password_clear_sync')) {
                        const moreInfoResponse = 'More Info';
                        const response = await vscode.window.showErrorMessage('VS Live Share could not sign you in due to a missing or misconfigured keyring. Please ensure that all required Linux dependencies are installed.', moreInfoResponse, 'OK');
                        if (response === moreInfoResponse) {
                            util_1.ExtensionUtil.openBrowser('https://aka.ms/vsls-docs/linux-prerequisites');
                        }
                    }
                    else {
                        // unknown error
                        await util_1.ExtensionUtil.showErrorAsync(error);
                    }
                }
                return undefined;
            }
        }, options);
    }
    async signOut() {
        if (!session_1.SessionContext.IsSignedIn) {
            await vscode.window.showInformationMessage('Not signed in.');
            return;
        }
        if (session_1.SessionContext.IsStartingCollaboration) {
            await util_1.ExtensionUtil.showErrorAsync('Cannot sign out while collaboration is starting.');
            return;
        }
        return util_1.ExtensionUtil.runWithProgress(() => this.signOutHelper(), { title: 'Signing Out' });
    }
    async signOutHelper() {
        if (session_1.SessionContext.State === sessionTypes_1.SessionState.Joined) {
            const leavingResult = await this.leaveCollaboration({
                beforeLeave: this.logOutAsync
            });
            if (!leavingResult) {
                // We couldn't leave the collaboration (e.g. customer clicked
                // cancel on a save prompt, for example)
                return;
            }
        }
        else if (session_1.SessionContext.State === sessionTypes_1.SessionState.Shared) {
            await this.endCollaboration();
        }
        await this.logOutAsync();
    }
    async debug() {
        if (session_1.SessionContext.State !== sessionTypes_1.SessionState.Joined) {
            throw new Error('Not currently in a collaboration session.');
        }
        let debugSessions = session_1.SessionContext.joinDebugManager.getAvailableDebugSessions();
        if (debugSessions.length === 0) {
            await vscode.window.showInformationMessage('No debug session available to join');
            return;
        }
        if (debugSessions.length === 1) {
            await util_1.ExtensionUtil.runWithProgress(() => session_1.SessionContext.joinDebugManager.joinDebugSession(debugSessions[0]), { title: 'Joining Debug Session...' });
        }
        else {
            let items = [];
            debugSessions.forEach((d) => {
                items.push({
                    label: d.name
                });
            });
            let selection = (await vscode.window.showQuickPick(items, { placeHolder: 'Select the debug session' }));
            if (selection) {
                let debugSession = debugSessions.filter(item => item.name === selection.label)[0];
                await util_1.ExtensionUtil.runWithProgress(() => session_1.SessionContext.joinDebugManager.joinDebugSession(debugSession), { title: 'Joining Debug Session...' });
            }
        }
    }
    async onWorkspaceSessionChanged(e) {
        try {
            // Notify listeners of the session changing, *before* we go through the accept/reject flow
            // to ensure that the various internal states for displaying information have the latest
            // info. A primary example of this is that in the Notify mode, we shouldn't wait to notify
            // others that someone has joined -- this means all the user info etc is correct.
            // In the approval mode, this doesn't cause issues, because the collaborator interactions
            // are driven by the by co-editing counts, not just the simple join message.
            // Note: CollaboratorManager needs to be updated first because the status bar queries it to know the updated
            // list of co-editors.
            if (session_1.SessionContext.collaboratorManager) {
                session_1.SessionContext.collaboratorManager.onWorkspaceSessionChanged(e);
            }
            if (this.statusBarController) {
                this.statusBarController.onWorkspaceSessionChanged(e);
            }
            if (session_1.SessionContext.coeditingClient) {
                session_1.SessionContext.coeditingClient.onWorkspaceSessionChanged(e);
            }
            if (session_1.SessionContext.State === sessionTypes_1.SessionState.Shared) {
                await this.workspaceAccessControlManager().onWorkspaceSessionChanged(e);
            }
        }
        catch (e) {
            traceSource_1.traceSource.error(e);
        }
    }
    async onWorkspaceConnectionStatusChanged(e) {
        if (e.connectionStatus !== vsls.WorkspaceConnectionStatus.Disconnected &&
            e.connectionStatus !== vsls.WorkspaceConnectionStatus.Unavailable) {
            return;
        }
        if (e.disconnectedReason === vsls.WorkspaceDisconnectedReason.Requested) {
            return;
        }
        if (session_1.SessionContext.State === sessionTypes_1.SessionState.Joined) {
            let message;
            let isError = false;
            switch (e.disconnectedReason) {
                case vsls.WorkspaceDisconnectedReason.SessionEnded:
                    message = util_1.ExtensionUtil.getString('notification.SessionEnded');
                    break;
                case vsls.WorkspaceDisconnectedReason.SessionExpired:
                    message = util_1.ExtensionUtil.getString('notification.SessionExpired');
                    isError = true;
                    break;
                case vsls.WorkspaceDisconnectedReason.UserRemoved:
                    message = util_1.ExtensionUtil.getString('notification.UserRemoved');
                    break;
                case vsls.WorkspaceDisconnectedReason.ConnectionLost:
                    message = util_1.ExtensionUtil.getString('notification.ConnectionLost');
                    isError = true;
                    break;
                case vsls.WorkspaceDisconnectedReason.InternalError:
                default:
                    message = util_1.ExtensionUtil.getString('notification.InternalError');
                    isError = true;
                    break;
            }
            if (isError) {
                const reload = 'Try to rejoin';
                const items = (e.disconnectedReason === vsls.WorkspaceDisconnectedReason.ConnectionLost)
                    ? [reload]
                    : [];
                const workspaceConnectionErrorTelemetryEvent = new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.WORKSPACE_CONNECTION_ERROR)
                    .addProperty(telemetryStrings_1.TelemetryPropertyNames.EVENT_MESSAGE, message);
                const result = await vscode.window.showErrorMessage(message, { modal: util_1.ExtensionUtil.enableModalNotifications }, ...items);
                const isReloadSelected = result && (result === reload);
                workspaceConnectionErrorTelemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.RELOAD_SELECTED, isReloadSelected);
                workspaceConnectionErrorTelemetryEvent.send();
                if (isReloadSelected) {
                    await config.save(config.Key.joinEventCorrelationId, workspaceConnectionErrorTelemetryEvent.getCorrelationId());
                    return vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            }
            else {
                await vscode.window.showInformationMessage(message, { modal: util_1.ExtensionUtil.enableModalNotifications });
            }
            await this.leaveCollaboration({ skipUnjoin: true, initiatedRemotely: true });
        }
        else if (session_1.SessionContext.State === sessionTypes_1.SessionState.Shared &&
            e.disconnectedReason !== vsls.WorkspaceDisconnectedReason.SessionEnded) {
            let message;
            switch (e.disconnectedReason) {
                case vsls.WorkspaceDisconnectedReason.SessionExpired:
                    message = util_1.ExtensionUtil.getString('notification.SessionExpired');
                    await this.signOut(); /* calls endCollaboration internally */
                    break;
                case vsls.WorkspaceDisconnectedReason.NetworkDisconnected:
                    message = util_1.ExtensionUtil.getString('notification.NetworkDisconnected');
                    await this.endCollaboration();
                    break;
                case vsls.WorkspaceDisconnectedReason.ListenerWentOffline:
                    if (session_1.SessionContext.collaboratorManager.getCollaboratorCount() === 0) {
                        message = util_1.ExtensionUtil.getString('notification.ListenerWentOffline');
                        await this.endCollaboration();
                    }
                    else {
                        message = util_1.ExtensionUtil.getString('info.ListenerWentOffline');
                        await vscode.window.showInformationMessage(message, { modal: util_1.ExtensionUtil.enableModalNotifications });
                        return;
                    }
                    break;
                case vsls.WorkspaceDisconnectedReason.InternalError:
                default:
                    message = util_1.ExtensionUtil.getString('notification.InternalError');
                    await this.endCollaboration();
                    break;
            }
            await util_1.ExtensionUtil.showErrorAsync(message, { modal: util_1.ExtensionUtil.enableModalNotifications });
        }
    }
    onWorkspaceProgressUpdated(e) {
        switch (e.progress) {
            case vsls.WorkspaceProgress.WaitingForHost: {
                if (this.reloadEvent) {
                    this.reloadEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.START_WAITING_FOR_HOST);
                }
                if (this.joinProgress) {
                    this.joinProgress.report({ message: util_1.ExtensionUtil.getProgressUpdateString(e.progress) });
                }
                break;
            }
            case vsls.WorkspaceProgress.DoneWaitingForHost: {
                if (this.reloadEvent) {
                    this.reloadEvent.markTime(telemetryStrings_1.TelemetryPropertyNames.DONE_WAITING_FOR_HOST);
                }
                // No progress message update: the OpeningRemoteSession update immediately follows.
                break;
            }
            case vsls.WorkspaceProgress.OpeningRemoteSession:
            case vsls.WorkspaceProgress.JoiningRemoteSession: {
                if (this.joinProgress) {
                    this.joinProgress.report({ message: util_1.ExtensionUtil.getProgressUpdateString(e.progress) });
                }
                break;
            }
            default: {
                let event = new telemetry_1.TelemetryEvent(telemetryStrings_1.TelemetryEventNames.REPORT_AGENTPROGRESS, true);
                event.addProperty(telemetryStrings_1.TelemetryPropertyNames.EVENT_MESSAGE, e.progress);
                event.addMeasure(telemetryStrings_1.TelemetryPropertyNames.PROGRESS_DURATION, e.duration);
                event.send();
                break;
            }
        }
    }
    async summonParticipants() {
        if (!session_1.SessionContext.coeditingClient) {
            return;
        }
        session_1.SessionContext.coeditingClient.postMessage(coauthoringService_1.MessageFactory.SummonMessage(session_1.SessionContext.coeditingClient.clientID));
        await vscode.window.showInformationMessage('Focus request sent.');
    }
    async listSharedServers(origin) {
        if (session_1.SessionContext.State === sessionTypes_1.SessionState.Joined) {
            await this.listForwardedPorts();
        }
        else if (session_1.SessionContext.State === sessionTypes_1.SessionState.Shared) {
            await this.listSharedPorts();
        }
        else {
            throw new Error('Not currently in a collaboration session.');
        }
        portForwardingTelemetry_1.PortForwardingTelemetry.listSharedLocalServers(origin);
    }
    async listSharedPorts() {
        const sharedServers = await this.serverSharingService.getSharedServersAsync();
        if (sharedServers.length === 0) {
            await vscode.window.showInformationMessage('No TCP ports are currently shared in the collaboration session.', { modal: false });
            return;
        }
        const items = sharedServers.map((s) => `localhost:${s.sourcePort}` + (s.sessionName === `localhost:${s.sourcePort}` ? '' : ` shared as '${s.sessionName}'`));
        await vscode.window.showQuickPick(items, { placeHolder: 'The following local TCP ports are exposed in the collaboration session' });
    }
    async listForwardedPorts() {
        const sharedServers = await this.portForwardingService.getSharedServersAsync();
        if (sharedServers.length === 0) {
            await vscode.window.showInformationMessage('No TCP ports are currently shared in the collaboration session.', { modal: false });
            return;
        }
        let index = -1;
        if (sharedServers.length === 1) {
            index = 0;
        }
        else {
            const items = sharedServers.map((s) => s.sessionName === `localhost:${s.destinationPort}` ? s.sessionName : `${s.sessionName} mapped to localhost:${s.destinationPort}`);
            const selection = await vscode.window.showQuickPick(items, { placeHolder: 'Select exposed TCP port to copy to clipboard' });
            if (!selection) {
                return;
            }
            index = items.indexOf(selection);
        }
        if (index >= 0) {
            const server = sharedServers[index];
            const text = `localhost:${server.destinationPort}`;
            const forSessionName = server.sessionName === text ? '' : ` for ${server.sessionName}`;
            await clipboardy_1.write(text);
            const result = await vscode.window.showInformationMessage(`'${text}'${forSessionName} copied to clipboard.`, { title: 'Copy again' });
            if (result) {
                await clipboardy_1.write(text);
            }
        }
    }
    async shareServer(origin) {
        if (session_1.SessionContext.State !== sessionTypes_1.SessionState.Shared) {
            throw new Error('Not currently hosting a collaboration session.');
        }
        const sharedServers = await this.serverSharingService.getSharedServersAsync();
        function validatePortNumber(value) {
            if (value !== undefined && value !== '') {
                const n = parseFloat(value);
                if (isNaN(n) || !Number.isInteger(n) || n <= 0 || n > 65535) {
                    return 'The port number must be an integer in range 1 - 65535';
                }
                const s = sharedServers.find(server => server.sourcePort === n);
                if (s) {
                    return `Local TCP port ${n} is already being shared${s.sessionName === `localhost:${s.sourcePort}` ? '' : ` as '${s.sessionName}'`}`;
                }
            }
            return null;
        }
        const portValue = await vscode.window.showInputBox({
            prompt: 'Enter port to expose to collaborators',
            ignoreFocusOut: true,
            validateInput: validatePortNumber,
        });
        if (portValue === undefined || portValue === '') {
            return;
        }
        const port = parseFloat(portValue);
        const sessionName = await vscode.window.showInputBox({
            value: `localhost:${port}`,
            prompt: '[Optional] Name the port for reference by collaborators',
            ignoreFocusOut: true,
        });
        const sharedServer = await this.serverSharingService.startSharingAsync(port, sessionName || `localhost:${port}`, null);
        const asSessionName = sharedServer.sessionName === `localhost:${port}` ? '' : ` as '${sharedServer.sessionName}'`;
        portForwardingTelemetry_1.PortForwardingTelemetry.shareServer(port, origin);
        await vscode.window.showInformationMessage(`Exposed local TCP port ${port}${asSessionName} in the collaboration session.`, { modal: false });
    }
    async unshareServer(origin) {
        if (session_1.SessionContext.State !== sessionTypes_1.SessionState.Shared) {
            throw new Error('Not currently hosting a collaboration session.');
        }
        const sharedServers = await this.serverSharingService.getSharedServersAsync();
        if (sharedServers.length === 0) {
            await vscode.window.showInformationMessage('No local TCP ports are currently shared in the collaboration session.', { modal: false });
            return;
        }
        const getServerName = (s) => `localhost:${s.sourcePort}` + (s.sessionName === `localhost:${s.sourcePort}` ? '' : ` shared as '${s.sessionName}'`);
        let server;
        if (sharedServers.length === 1) {
            server = sharedServers[0];
        }
        else {
            const items = sharedServers.map(getServerName);
            items.unshift('<All Shared TCP ports>');
            const selection = await vscode.window.showQuickPick(items, { placeHolder: 'Pick local TCP port to stop sharing in the collaboration session' });
            if (!selection) {
                return;
            }
            const index = items.indexOf(selection);
            if (index < 0) {
                return;
            }
            server = index > 0 ? sharedServers[index - 1] : null;
        }
        if (server) {
            await this.serverSharingService.stopSharingAsync(server.sourcePort);
            portForwardingTelemetry_1.PortForwardingTelemetry.unshareServer(server.sourcePort, origin);
            await vscode.window.showInformationMessage(`Stopped sharing ${getServerName(server)} in the collaboration session.`, { modal: false });
        }
        else {
            for (server of sharedServers) {
                await this.serverSharingService.stopSharingAsync(server.sourcePort);
                portForwardingTelemetry_1.PortForwardingTelemetry.unshareServer(server.sourcePort, origin);
            }
            await vscode.window.showInformationMessage('Stopped sharing all previousely shared local TCP ports in the collaboration session.', { modal: false });
        }
    }
    async unshareServerBySourcePort(item) {
        if (!item || (item.sourcePort == null)) {
            return;
        }
        await this.serverSharingService.stopSharingAsync(item.sourcePort);
        await vscode.window.showInformationMessage(`Stopped sharing port ${item.sourcePort} in the collaboration session.`);
    }
    async openSharedServerInBrowser(item) {
        if (!item || (item.sourcePort == null)) {
            return;
        }
        util_1.ExtensionUtil.openBrowser(`http://localhost:${item.sourcePort}`);
    }
    async copySharedServerURL(item) {
        if (!item || (item.sourcePort == null)) {
            return;
        }
        await clipboardy_1.write(`http://localhost:${item.sourcePort}`);
        await vscode.window.showInformationMessage('The server URL was copied to your clipboard.');
    }
    async hostAdapterService_RunInTerminal(args) {
        const shareKind = config.get(config.Key.shareDebugTerminal);
        if (session_1.SessionContext.State !== sessionTypes_1.SessionState.Shared
            || shareKind === 'off'
            || !config_1.featureFlags.sharedTerminals
            || !config_1.featureFlags.shareDebugTerminal
            || !args.args) {
            return null;
        }
        let options = {
            name: `${args.title} [Shared]`,
            rows: config.get(config.Key.sharedTerminalHeight),
            cols: config.get(config.Key.sharedTerminalWidth),
            cwd: args.cwd || util.PathUtil.getPrimaryWorkspaceFileSystemPath(),
            environment: args.env,
            readOnlyForGuests: shareKind !== 'readWrite',
            isSharedDebugTerminal: true,
        };
        if (os.platform() === util.OSPlatform.WINDOWS) {
            const isWoW64 = !!process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432');
            options.app = `${process.env.windir ? process.env.windir : 'C:'}\\${isWoW64 ? 'Sysnative' : 'System32'}\\cmd.exe`;
            options.verbatimCommandLine = true,
                options.commandLine = ['/c', `""${args.args.join('" "')}""`];
        }
        else {
            options.app = 'bash';
            options.commandLine = ['-c', `'${args.args.join('\' \'')}'`];
        }
        const terminalInfo = await this.terminalService.startTerminalAsync(options);
        args.args = [agent_1.Agent.getAgentPath(), 'run-terminal', terminalInfo.localPipeName];
        return { args };
    }
    async listParticipants(origin) {
        await vscode.commands.executeCommand(Commands.pinCommandId, true);
    }
    async exportLogsAsync() {
        const saveUri = await vscode.window.showSaveDialog({
            filters: { 'Zipped Log Files': ['zip'] },
        });
        if (!saveUri || !saveUri.fsPath)
            return;
        const zipFilePath = saveUri.fsPath;
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Window }, async () => {
            await logZipExporter_1.LogZipExporter.createLogZipFileAsync(zipFilePath, logFileTraceListener_1.LogFileTraceListener.defaultLogDirectory);
            await clipboardy_1.write(zipFilePath);
            vscode.window.showInformationMessage(`Logs exported to ${zipFilePath} (path copied to clipboard)`);
        });
    }
}
Commands.pinCommandId = 'liveshare.follow';
Commands.followToTheSideCommandId = 'liveshare.followToTheSide';
Commands.followToTheSideActivityBarCommandId = 'liveshare.followToTheSideFromActivityBar';
Commands.followToTheSideTreeExplorerCommandId = 'liveshare.followToTheSideFromTreeExplorer';
Commands.pinFromFileTreeExplorerCommandId = 'liveshare.followFromFileTreeExplorer';
Commands.pinFromActivityBarCommandId = 'liveshare.followFromActivityBar';
Commands.unpinCommandId = 'liveshare.unfollow';
Commands.unpinFromFileTreeExplorerCommandId = 'liveshare.unfollowFromFileTreeExplorer';
Commands.unpinFromActivityBarCommandId = 'liveshare.unfollowFromActivityBar';
Commands.stateCommandContext = 'liveshare:state';
Commands.hasCollaboratorsCommandContext = 'liveshare:hasCollaborators';
Commands.showExplorerCommandContext = 'liveshare:showExplorer';
Commands.pinnableCommandContext = 'liveshare:isFollowable';
Commands.pinnedCommandContext = 'liveshare:isFollowing';
Commands.isCollaboratingCommandContext = 'liveshare:isCollaborating';
Commands.isServerSharedCommandContext = 'liveshare:isServerShared';
Commands.hasSharedTerminalsCommandContext = 'liveshare:hasSharedTerminals';
Commands.supportSharedTerminalsCommandContext = 'liveshare:supportSharedTerminals';
Commands.supportSummonParticipantsCommandContext = 'liveshare:supportSummonParticipants';
Commands.readOnlySessionCommandContext = 'liveshare:isReadOnlySession';
Commands.logsEnabled = 'liveshare:logsEnabled';
Commands.joinWorkspaceIdSettingName = 'vsliveshare.join.reload.workspaceId';
Commands.joinWorkspaceIdFolderSettingName = 'vsliveshare.join.reload.workspaceFolder';
Commands.listParticipantsCommandId = 'liveshare.listParticipants';
Commands.INIT_SIGN_IN_TIMEOUT = 10000;
Commands.joinLinkRegex = /https?:\/\/.*\/join\/?\?([0-9A-Z]+)/i;
Commands.cascadeLinkRegex = new RegExp(`${config.get(config.Key.scheme)}:\?.*join.*workspaceId=([0-9A-Z-]+)`, 'i');
Commands.userCodeRegex = /^(([a-z]{4}\-){3})(([a-z]{4}){1})$/i;
// Regex for e.g.:    [a1b2-c3d4-e5g6-h7i8:abc123-def456-ghi789]
//   capture group 1:  a1b2-c3d4-e5g6-h7i8                       (user code)
//   capture group 2:                      abc123-def456-ghi789  (extension ID)
//
// \[                 [
// ((?:[a-z]{4}\-){3}  a1b2-c3d4-e5g6-
// (?:[a-z]{4}){1})                   h7i8
// :[a-z0-9-]*)                           :abc123-def456-ghi789
// \]                                                          ]
Commands.userCodeWithExtensionIdRegex = /\[((?:[a-z]{4}\-){3}(?:[a-z]{4}){1}):([a-z0-9-]*)\]/i;
exports.Commands = Commands;

//# sourceMappingURL=commands.js.map
