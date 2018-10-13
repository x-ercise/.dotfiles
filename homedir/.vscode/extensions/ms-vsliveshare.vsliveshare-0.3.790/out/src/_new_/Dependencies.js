"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
const vsls = require("../contracts/VSLS");
const util_1 = require("../util");
const session_1 = require("../session");
const shareDebugManager_1 = require("../debugger/shareDebugManager");
const telemetry_1 = require("../telemetry/telemetry");
const traceSource_1 = require("../tracing/traceSource");
const service_1 = require("../workspace/service");
const AuthenticationProvider_1 = require("./authentication/AuthenticationProvider");
const AuthenticationFlow_1 = require("./authentication/AuthenticationFlow");
const AuthenticationFindCodeUtilMacWin_1 = require("./authentication/AuthenticationFindCodeUtilMacWin");
const AuthenticationFindCodeUtilLinux_1 = require("./authentication/AuthenticationFindCodeUtilLinux");
const CommandContextBuilder_1 = require("./CommandContextBuilder");
const CommandRegistryProvider_1 = require("./CommandRegistryProvider");
const ExtensionSetup_1 = require("./ExtensionSetup");
const StringUtil_1 = require("./util/StringUtil");
const NotificationUtil_1 = require("./util/NotificationUtil");
const ClipboardUtil_1 = require("./util/ClipboardUtil");
const BrowserUtil_1 = require("./util/BrowserUtil");
const ContextUtil_1 = require("./util/ContextUtil");
const ConfigUtil_1 = require("./util/ConfigUtil");
const WorkspaceEnvironmentUtil_1 = require("./util/WorkspaceEnvironmentUtil");
const WorkspacePromptsUtil_1 = require("./util/WorkspacePromptsUtil");
const WorkspaceFirewallUtil_1 = require("./util/WorkspaceFirewallUtil");
const ProgressNotifierUtil_1 = require("./util/ProgressNotifierUtil");
const ShareDebugManager_1 = require("./managers/ShareDebugManager");
const LspServerManager_1 = require("./managers/LspServerManager");
const WorkspaceTaskManager_1 = require("./managers/WorkspaceTaskManager");
const CoEditingManager_1 = require("./managers/CoEditingManager");
const WorkspaceCommandsManager_1 = require("./managers/WorkspaceCommandsManager");
const BreakpointManager_1 = require("./managers/BreakpointManager");
const ShareBreakpointManager_1 = require("./managers/ShareBreakpointManager");
const JoinBreakpointManager_1 = require("./managers/JoinBreakpointManager");
const GuestTrackerManager_1 = require("./managers/GuestTrackerManager");
const AgentSessionContextUpdateListener_1 = require("./providers/AgentSessionContextUpdateListener");
const ElectronSignInModalUtil_1 = require("./util/ElectronSignInModalUtil");
const workspaceAccessControlManager_1 = require("../accessControl/workspaceAccessControlManager");
const accessControlManager_1 = require("../accessControl/accessControlManager");
const fileSystemManager_1 = require("../workspace/fileSystemManager");
const TextSearchManager_1 = require("./managers/TextSearchManager");
const clientAccessCheck_1 = require("../accessControl/clientAccessCheck");
const JoinedCommandManager_1 = require("./managers/JoinedCommandManager");
const SearchProviderManager_1 = require("./managers/SearchProviderManager");
const AdditionalRootsManager_1 = require("./managers/AdditionalRootsManager");
const JoinDebugManagerFacade_1 = require("./managers/JoinDebugManagerFacade");
const WorkspaceTaskClientManager_1 = require("./managers/WorkspaceTaskClientManager");
const terminalManager_1 = require("../terminal/terminalManager");
function lazyLoad(loader) {
    let cache;
    return () => cache || (cache = loader());
}
exports.lazyLoad = lazyLoad;
function lazyLoadNotImplemented() {
    throw new Error('Dependencies: Instance not provided.');
}
exports.lazyLoadNotImplemented = lazyLoadNotImplemented;
exports.dependencies = (function (sessionContext, trace, telemetry) {
    const context = {
        sessionContext: () => sessionContext,
        trace: () => trace,
        telemetry: () => telemetry,
        authService: lazyLoad(() => service_1.RpcProxy.create(vsls.AuthenticationService, context.rpcClient(), vsls.TraceSources.ClientRpcAuth)),
        workspaceAccessControlService: lazyLoad(() => service_1.RpcProxy.create(vsls.WorkspaceAccessControlService, context.rpcClient(), vsls.TraceSources.ClientWorkspaceAccessControl)),
        workspaceService: lazyLoad(() => service_1.RpcProxy.create(vsls.WorkspaceService, context.rpcClient(), vsls.TraceSources.ClientRpcWorkspace)),
        workspaceUserService: lazyLoad(() => service_1.RpcProxy.create(vsls.WorkspaceUserService, context.rpcClient(), vsls.TraceSources.ClientRpcWorkspaceUser)),
        sourceEventService: lazyLoad(() => service_1.RpcProxy.create(vsls.SourceEventService, context.rpcClient(), vsls.TraceSources.ClientRpcSourceEvent)),
        firewallService: lazyLoad(() => service_1.RpcProxy.create(vsls.FirewallService, context.rpcClient(), vsls.TraceSources.ClientRpc)),
        fileService: lazyLoad(() => service_1.RpcProxy.create(vsls.FileService, context.rpcClient(), vsls.TraceSources.ClientRpcFile)),
        sessionContextService: lazyLoad(() => service_1.RpcProxy.create(vsls.SessionContextService, context.rpcClient(), vsls.TraceSources.ClientRpcSessionContext)),
        extensionSetup: lazyLoad(() => new ExtensionSetup_1.ExtensionSetup(context.commandRegistryProvider(), context.agentSessionContextUpdateListener(), context.configUtil())),
        stringUtil: lazyLoad(() => new StringUtil_1.StringUtil()),
        notificationUtil: lazyLoad(() => new NotificationUtil_1.NotificationUtil()),
        contextUtil: lazyLoad(() => new ContextUtil_1.ContextUtil()),
        clipboardUtil: lazyLoad(() => new ClipboardUtil_1.ClipboardUtil()),
        browserUtil: lazyLoad(() => new BrowserUtil_1.BrowserUtil()),
        electronSignInModalUtil: lazyLoad(() => new ElectronSignInModalUtil_1.ElectronSignInModalUtil()),
        configUtil: lazyLoad(() => new ConfigUtil_1.ConfigUtil()),
        workspaceEnvironmentUtil: lazyLoad(() => new WorkspaceEnvironmentUtil_1.WorkspaceEnvironmentUtil()),
        workspacePromptsUtil: lazyLoad(() => new WorkspacePromptsUtil_1.WorkspacePromptsUtil(sessionContext, context.stringUtil(), context.notificationUtil(), context.clipboardUtil(), context.browserUtil(), context.workspaceAccessControlManager)),
        workspaceFirewallUtil: lazyLoad(() => new WorkspaceFirewallUtil_1.WorkspaceFirewallUtil(context.firewallService(), context.workspacePromptsUtil(), context.configUtil())),
        progressNotifierUtil: lazyLoad(() => new ProgressNotifierUtil_1.ProgressNotifierUtil(sessionContext, context.notificationUtil(), context.contextUtil(), context.workspaceService(), trace.withName('Progress'))),
        authenticationProvider: lazyLoad(() => new AuthenticationProvider_1.AuthenticationProvider(context.authService(), sessionContext, os.platform() === util_1.OSPlatform.LINUX ? new AuthenticationFindCodeUtilLinux_1.AuthenticationFindCodeUtilLinux(context.notificationUtil(), trace) : new AuthenticationFindCodeUtilMacWin_1.AuthenticationFindCodeUtilMacWin(context.authService()), context.configUtil())),
        authenticationFlow: lazyLoad(() => new AuthenticationFlow_1.AuthenticationFlow(context.authenticationProvider(), sessionContext, context.browserUtil(), context.electronSignInModalUtil(), trace.withName('Auth'))),
        commandContextBuilder: lazyLoad(() => new CommandContextBuilder_1.CommandContextBuilder(trace)),
        commandRegistryProvider: lazyLoad(() => new CommandRegistryProvider_1.CommandRegistryProvider(context.commandContextBuilder(), telemetry, trace.withName('CommandRegistry'))),
        shareDebugManager: lazyLoad(() => new ShareDebugManager_1.ShareDebugManager(new shareDebugManager_1.ShareDebugManager(context.rpcClient(), context.hostAdapterService(), context.fileService(), context.debugManager(), context.workspaceAccessControlManager()))),
        lspServerManager: lazyLoad(() => new LspServerManager_1.LspServerManager(context.workspaceService(), context.clientAccessCheck)),
        workspaceTaskManager: lazyLoad(() => new WorkspaceTaskManager_1.WorkspaceTaskManager(context.rpcClient(), context.workspaceService(), context.clientAccessCheck)),
        coEditingHostManager: lazyLoad(() => new CoEditingManager_1.CoEditingHostManager(context)),
        coEditingGuestManager: lazyLoad(() => new CoEditingManager_1.CoEditingGuestManager(context)),
        workspaceCommandManager: lazyLoad(() => new WorkspaceCommandsManager_1.WorkspaceCommandsManager()),
        breakpointManager: lazyLoad(() => new BreakpointManager_1.BreakpointManager(context.sourceEventService())),
        shareBreakpointManager: lazyLoad(() => new ShareBreakpointManager_1.ShareBreakpointManager(context.breakpointManager())),
        joinBreakpointManager: lazyLoad(() => new JoinBreakpointManager_1.JoinBreakpointManager(context.breakpointManager())),
        guestTrackerManager: lazyLoad(() => new GuestTrackerManager_1.GuestTrackerManager(sessionContext, telemetry, context.notificationUtil(), context.browserUtil(), trace)),
        textSearchManager: lazyLoad(() => new TextSearchManager_1.TextSearchManager(context.workspaceService())),
        agentSessionContextUpdateListener: lazyLoad(() => new AgentSessionContextUpdateListener_1.AgentSessionContextUpdateListener(context.sessionContextService(), sessionContext, trace)),
        serverSharingService: lazyLoad(() => service_1.RpcProxy.create(vsls.ServerSharingService, context.rpcClient(), vsls.TraceSources.ClientRpcServerSharing)),
        portForwardingService: lazyLoad(() => service_1.RpcProxy.create(vsls.PortForwardingService, context.rpcClient(), vsls.TraceSources.ClientRpcPortForwarding)),
        terminalService: lazyLoad(() => service_1.RpcProxy.create(vsls.TerminalService, context.rpcClient(), vsls.TraceSources.ClientRpcPortForwarding)),
        terminalManager: lazyLoad(() => new terminalManager_1.TerminalManager(context.terminalService(), context.notificationUtil(), context.workspaceAccessControlManager, context.accessControlManager)),
        debuggerHostService: lazyLoad(() => service_1.RpcProxy.create(vsls.DebuggerHostService, context.rpcClient(), vsls.TraceSources.DebugHost)),
        workspaceAccessControlManager: lazyLoad(() => new workspaceAccessControlManager_1.WorkspaceAccessControlManager(context.workspaceAccessControlService(), context.workspaceUserService(), context.terminalManager())),
        accessControlService: lazyLoad(() => service_1.RpcProxy.create(vsls.AccessControlService, context.rpcClient(), vsls.TraceSources.ClientAccessControl)),
        accessControlManager: lazyLoad(() => new accessControlManager_1.AccessControlManager(context.workspaceAccessControlService(), context.accessControlService(), context.fileSystemManager(), context.terminalManager)),
        clientAccessCheck: lazyLoad(() => clientAccessCheck_1.getClientAccessCheck(context)),
        telemetryService: lazyLoad(() => service_1.RpcProxy.create(vsls.TelemetryService, context.rpcClient(), vsls.TraceSources.ClientRpc)),
        fileSystemManager: lazyLoad(() => new fileSystemManager_1.FileSystemManager(context.workspaceService(), context.fileService())),
        joinedCommandManager: lazyLoad(() => { return new JoinedCommandManager_1.JoinedCommandManager(context); }),
        searchProviderManager: lazyLoad(() => { return new SearchProviderManager_1.SearchProviderManager(context); }),
        additionalRootsManager: lazyLoad(() => { return new AdditionalRootsManager_1.AdditionalRootsManager(context); }),
        joinDebugManagerFacade: lazyLoad(() => { return new JoinDebugManagerFacade_1.JoinDebugManagerFacade(context); }),
        workspaceTaskClientManager: lazyLoad(() => { return new WorkspaceTaskClientManager_1.WorkspaceTaskClientManager(context.rpcClient()); }),
        hostAdapterService: lazyLoadNotImplemented,
        rpcClient: lazyLoadNotImplemented,
        debugManager: lazyLoadNotImplemented,
        statusBarController: lazyLoadNotImplemented
    };
    return context;
})(session_1.SessionContext, traceSource_1.traceSource, telemetry_1.Instance);

//# sourceMappingURL=Dependencies.js.map
