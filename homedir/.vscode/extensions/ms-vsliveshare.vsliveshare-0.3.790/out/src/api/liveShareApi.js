//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
//
// Implementation of Live Share for VS Code extension public API.
// See LiveShare.ts for public type definitons.
//
const path = require("path");
const semver = require("semver");
const vscode = require("vscode");
const vsls = require("../contracts/VSLS");
const liveShare_1 = require("./liveShare");
const telemetry_1 = require("../telemetry/telemetry");
const telemetryStrings_1 = require("../telemetry/telemetryStrings");
const session_1 = require("../session");
const sessionTypes_1 = require("../sessionTypes");
const sharedServiceApi_1 = require("./sharedServiceApi");
const checkArg_1 = require("./checkArg");
const config = require("../config");
const packageInfo_1 = require("./packageInfo");
const contributions_1 = require("./contributions");
const traceSource_1 = require("../tracing/traceSource");
const vslsPublisher = require('../../../package.json').publisher;
/**
 * RPC variables are intentionally NOT private members of public API objects,
 * to prevent extensions from trivially using the private members to make
 * arbitrary RPC calls.
 */
const privateContext = {
    client: null,
    workspaceService: null,
    workspaceUserService: null,
    workspaceManager: null,
    pathManager: null,
};
/**
 * Implementation of the root API that is used to acquire access to the
 * main Live Share API.
 *
 * An instance of this class is returned by the Live Share extension's
 * activation function.
 */
class LiveShareExtensionApi {
    constructor(rpcClient, workspaceService, workspaceUserService, workspaceManager, pathManager) {
        /**
         * Callers that request an API version outside this range will get `null`,
         * which should be treated the same as if Live Share is not installed.
         */
        this.supportedApiVersionRange = '>=0.3.0 <0.4.0';
        privateContext.client = rpcClient;
        privateContext.workspaceService = workspaceService;
        privateContext.workspaceUserService = workspaceUserService;
        privateContext.workspaceManager = workspaceManager;
        privateContext.pathManager = pathManager;
        if (!LiveShareExtensionApi.trace) {
            LiveShareExtensionApi.trace = traceSource_1.traceSource.withName(vsls.TraceSources.API);
        }
    }
    async getApi(requestedApiVersion) {
        checkArg_1.default(requestedApiVersion, 'requestedApiVersion', 'string');
        let callingPackage = packageInfo_1.getCallingPackage('LiveShareExtensionApi.getApi');
        if (!callingPackage) {
            // Check deprecated function name for back-compat.
            callingPackage = packageInfo_1.getCallingPackage('LiveShareExtensionApi.getApiAsync');
        }
        if (!callingPackage) {
            LiveShareExtensionApi.trace.warning('Live Share API request failed ' +
                'because calling package could not be detected.');
            return null;
        }
        if (!semver.satisfies(requestedApiVersion.split('-')[0], // Ignore any prelease tag
        this.supportedApiVersionRange)) {
            // The current version is always supported. This enables dev scenarios
            // where the current version is outside the supported range defined above.
            const packageJsonPath = path.join(__dirname, '..', '..', '..', 'src', 'api', 'package.json');
            const currentVersion = require(packageJsonPath).version;
            if (!semver.eq(requestedApiVersion, currentVersion)) {
                LiveShareExtensionApi.trace.warning(`Package ${callingPackage.fullName}@${callingPackage.version} requested` +
                    ` Live Share API version ${requestedApiVersion} that is not supported.`);
                return null;
            }
        }
        return new LiveShareApi(callingPackage, requestedApiVersion, LiveShareExtensionApi.trace);
    }
    /** @deprecated */
    getApiAsync(requestedApiVersion) {
        return this.getApi(requestedApiVersion);
    }
}
exports.LiveShareExtensionApi = LiveShareExtensionApi;
/**
 * Main API that enables other VS Code extensions to access Live Share capabilities.
 *
 * An instance of this class is created by the extension API above.
 */
class LiveShareApi {
    constructor(callingPackage, apiVersion, trace) {
        this.callingPackage = callingPackage;
        this.apiVersion = apiVersion;
        this.trace = trace;
        this.sessionChangeEvent = new vscode.EventEmitter();
        this.currentPeers = [];
        this.peersChangeEvent = new vscode.EventEmitter();
        /** When in Host role, tracks the services that are shared via this API. */
        this.sharedServices = {};
        /** When in Guest role, tracks the service proxies that are obtained via this API. */
        this.serviceProxies = {};
        checkArg_1.default(callingPackage, 'callingPackage', 'object');
        checkArg_1.default(apiVersion, 'apiVersion', 'string');
        // Ensure the callingPackage property cannot be modified.
        // Note the PackageInfo object is also immutable.
        Object.defineProperty(this, 'callingPackage', {
            enumerable: false,
            configurable: false,
            writable: false,
            value: this.callingPackage,
        });
        trace.info(`Initializing Live Share API ${apiVersion} for ` +
            `${callingPackage.fullName}@${callingPackage.version}`);
        this.sendActivatedTelemetryEvent();
        // Initialize session state.
        const sessionInfo = session_1.SessionContext.workspaceSessionInfo;
        this.session = {
            peerNumber: (sessionInfo ? sessionInfo.sessionNumber : 0),
            user: null,
            role: LiveShareApi.getSessionRole(session_1.SessionContext.State),
            access: LiveShareApi.getSessionAccess(session_1.SessionContext.State),
            id: (sessionInfo ? sessionInfo.id : null),
        };
        // Initialise current user info, if any.
        this.onSignedIn();
        // Register internal event handlers.
        session_1.SessionContext.addListener(sessionTypes_1.SessionEvents.StateChanged, (state) => this.onSessionStateChanged(state));
        privateContext.workspaceService.onServicesChanged((e) => this.onServicesChanged(e));
        privateContext.workspaceUserService.onWorkspaceSessionChanged((e) => this.onUserSessionChanged(e));
    }
    get onDidChangeSession() {
        return this.sessionChangeEvent.event;
    }
    get peers() {
        return this.currentPeers.slice(0);
    }
    get onDidChangePeers() {
        return this.peersChangeEvent.event;
    }
    async share(options) {
        if (this.session.role === liveShare_1.Role.Guest) {
            throw new Error('Cannot share while joined to another session.');
        }
        else if (this.session.role === liveShare_1.Role.Host) {
            if (options && options.access) {
                throw new Error('Cannot change default access ' +
                    'for an already shared session.');
            }
        }
        const command = 'liveshare.start';
        this.sendInvokeCommandTelemetryEvent(command, options);
        return await vscode.commands.executeCommand(command, options);
    }
    async join(link, options) {
        checkArg_1.default(link, 'link', 'uri');
        if (this.session.role !== liveShare_1.Role.None) {
            throw new Error('A session is already active.');
        }
        const command = 'liveshare.join';
        this.sendInvokeCommandTelemetryEvent(command, options);
        await vscode.commands.executeCommand(command, link, options);
    }
    async end() {
        if (this.session.role === liveShare_1.Role.Guest) {
            const command = 'liveshare.leave';
            this.sendInvokeCommandTelemetryEvent(command);
            await vscode.commands.executeCommand(command);
        }
        else if (this.session.role === liveShare_1.Role.Host) {
            const command = 'liveshare.end';
            this.sendInvokeCommandTelemetryEvent(command);
            await vscode.commands.executeCommand(command);
        }
    }
    async shareService(name) {
        checkArg_1.default(name, 'name', 'string');
        const isPermitted = this.hasPermission("shareServices" /* shareServices */);
        this.sendShareServiceTelemetryEvent(name, isPermitted);
        if (!isPermitted) {
            this.trace.warning(`shareService(${name}) not permitted.`);
            return null;
        }
        name = this.callingPackage.fullName + '.' + name;
        this.trace.verbose(`shareService(${name})`);
        let sharedService = this.sharedServices[name];
        if (!sharedService) {
            const connection = await privateContext.client.ensureConnectionAsync();
            sharedService = new sharedServiceApi_1.SharedServiceApi(name, connection, this.trace);
            this.sharedServices[name] = sharedService;
            if (this.session.role === liveShare_1.Role.Host) {
                try {
                    await privateContext.workspaceService.registerServicesAsync([name], vsls.WorkspaceServicesChangeType.Add);
                }
                catch (e) {
                    this.trace.error(e);
                    throw e;
                }
                sharedService._isServiceAvailable = true;
                sharedService._fireIsAvailableChange();
            }
        }
        return sharedService;
    }
    async unshareService(name) {
        checkArg_1.default(name, 'name', 'string');
        name = this.callingPackage.fullName + '.' + name;
        this.trace.verbose(`unshareService(${name})`);
        const sharedService = this.sharedServices[name];
        if (sharedService && sharedService.isServiceAvailable) {
            try {
                await privateContext.workspaceService.registerServicesAsync([name], vsls.WorkspaceServicesChangeType.Remove);
            }
            catch (e) {
                this.trace.error(e);
                throw e;
            }
            sharedService._isServiceAvailable = false;
            sharedService._fireIsAvailableChange();
        }
        delete this.sharedServices[name];
    }
    async getSharedService(name) {
        checkArg_1.default(name, 'name', 'string');
        if (name.indexOf('.') < 0) {
            name = this.callingPackage.fullName + '.' + name;
        }
        this.trace.verbose(`getSharedService(${name})`);
        let serviceProxy = this.serviceProxies[name];
        if (!serviceProxy) {
            const connection = await privateContext.client.ensureConnectionAsync();
            serviceProxy = new sharedServiceApi_1.SharedServiceApi(name, connection, this.trace);
            this.serviceProxies[name] = serviceProxy;
            if (this.session.role === liveShare_1.Role.Guest &&
                privateContext.workspaceManager.registeredServices.has(name)) {
                serviceProxy._isServiceAvailable = true;
            }
        }
        return serviceProxy;
    }
    convertLocalUriToShared(localUri) {
        checkArg_1.default(localUri, 'localUri', 'uri');
        if (this.session.role !== liveShare_1.Role.Host) {
            throw new Error('Only the host role can convert shared URIs.');
        }
        const scheme = config.get(config.Key.scheme);
        if (localUri.scheme === scheme) {
            throw new Error(`URI is already a ${scheme} URI: ${localUri}`);
        }
        if (localUri.scheme !== 'file') {
            throw new Error(`Not a workspace file URI: ${localUri}`);
        }
        const protocolUri = privateContext.pathManager.code2protocolWorkspaceFilesOnly(localUri);
        if (!protocolUri) {
            throw new Error(`URI was not part of a workspace: ${localUri}`);
        }
        return protocolUri;
    }
    convertSharedUriToLocal(sharedUri) {
        checkArg_1.default(sharedUri, 'sharedUri', 'uri');
        if (this.session.role !== liveShare_1.Role.Host) {
            throw new Error('Only the host role can convert shared URIs.');
        }
        const scheme = config.get(config.Key.scheme);
        if (sharedUri.scheme !== scheme) {
            throw new Error(`Not a ${config.get(config.Key.shortName)} shared URI: ${sharedUri}`);
        }
        return privateContext.pathManager.protocolUri2CodeUriConverter(sharedUri);
    }
    registerCommand(command, isEnabled, thisArg) {
        const isPermitted = this.hasPermission("contributeCommands" /* contributeCommands */);
        if (!isPermitted) {
            this.trace.warning(`registerCommand(${command}) not permitted.`);
            return null;
        }
        const contributions = contributions_1.ExtensionContributions.getContributions(this.callingPackage, this.trace);
        return contributions.registerCommand(command, isEnabled, thisArg);
    }
    static getSessionRole(state) {
        return (state === sessionTypes_1.SessionState.Shared ? liveShare_1.Role.Host :
            state === sessionTypes_1.SessionState.Joined ? liveShare_1.Role.Guest : liveShare_1.Role.None);
    }
    static getSessionAccess(state) {
        // TODO: Read-only access
        if (state === sessionTypes_1.SessionState.Shared) {
            return liveShare_1.Access.Owner;
        }
        return (state === sessionTypes_1.SessionState.Joined)
            ? liveShare_1.Access.ReadWrite
            : liveShare_1.Access.None;
    }
    /**
     * Callback from session context whenever state changes.
     * We only care about transitions to/from fully shared or joined states.
     */
    async onSessionStateChanged(state) {
        const newRole = LiveShareApi.getSessionRole(state);
        if (!this.session.user && (newRole !== liveShare_1.Role.None || state === sessionTypes_1.SessionState.SignedIn)) {
            this.onSignedIn();
        }
        else if (this.session.user && state === sessionTypes_1.SessionState.SignedOut) {
            this.onSignedOut();
        }
        if (newRole === this.session.role) {
            return;
        }
        const sessionChange = this.session;
        sessionChange.role = newRole;
        let peersChangeEvent = null;
        const changedServices = [];
        if (newRole === liveShare_1.Role.Host) {
            peersChangeEvent = await this.onShared(changedServices);
        }
        else if (newRole === liveShare_1.Role.Guest) {
            peersChangeEvent = await this.onJoined(changedServices);
        }
        else {
            peersChangeEvent = await this.onEnded(changedServices);
        }
        // Raise all events at the end, after all state was updated.
        this.trace.verbose(`^onDidChangeSession(${liveShare_1.Role[newRole]})`);
        this.sessionChangeEvent.fire({ session: this.session });
        if (peersChangeEvent) {
            this.trace.verbose(`^onDidChangePeers(${JSON.stringify(peersChangeEvent)})`);
            this.peersChangeEvent.fire(peersChangeEvent);
        }
        for (const s of changedServices) {
            s._fireIsAvailableChange();
        }
    }
    /**
     * The user signed in. Update the current user info.
     */
    onSignedIn() {
        // There is currently no public event raised for signing in.
        if (this.hasPermission("readUserProfile" /* readUserProfile */)) {
            this.session.user = session_1.SessionContext.userInfo && {
                displayName: session_1.SessionContext.userInfo.displayName,
                emailAddress: session_1.SessionContext.userInfo.emailAddress,
            };
        }
    }
    /**
     * The user signed out. Update the current user info.
     */
    onSignedOut() {
        // There is currently no public event raised for signing out. 
        this.session.user = null;
    }
    /**
     * A hosted sharing session started. Register any shared services
     * and update current session info.
     */
    async onShared(changedServices) {
        const sharedServiceNames = Object.keys(this.sharedServices);
        if (sharedServiceNames.length > 0) {
            try {
                await privateContext.workspaceService.registerServicesAsync(sharedServiceNames, vsls.WorkspaceServicesChangeType.Add);
            }
            catch (e) {
                this.trace.error(e);
                // Don't throw. This is an async event-handler,
                // so the caller would not await or catch the error.
            }
            for (let s of sharedServiceNames) {
                this.sharedServices[s]._isServiceAvailable = true;
                changedServices.push(this.sharedServices[s]);
            }
        }
        // Update current session info.
        const sessionInfo = session_1.SessionContext.workspaceSessionInfo;
        const sessionChange = this.session;
        sessionChange.peerNumber = sessionInfo.sessionNumber;
        sessionChange.access = LiveShareApi.getSessionAccess(sessionTypes_1.SessionState.Shared);
        sessionChange.id = sessionInfo.id || null;
        return null;
    }
    /**
     * Joined a sharing session as a guest. Make service proxies available,
     * update current session info, and initialize peers.
     */
    async onJoined(changedServices) {
        for (let s of Object.keys(this.serviceProxies)) {
            if (privateContext.workspaceManager.registeredServices.has(s)) {
                const serviceProxy = this.serviceProxies[s];
                serviceProxy._isServiceAvailable = true;
                changedServices.push(serviceProxy);
            }
        }
        // Update current session info.
        const sessionInfo = session_1.SessionContext.workspaceSessionInfo;
        const sessionChange = this.session;
        sessionChange.peerNumber = sessionInfo.sessionNumber;
        sessionChange.access = LiveShareApi.getSessionAccess(session_1.SessionContext.State);
        sessionChange.id = sessionInfo.id || null;
        const isUserProfilePermitted = this.hasPermission("readUserProfile" /* readUserProfile */);
        // Initalize peers array, includuing the host and any other already-joined guests.
        if (sessionInfo.sessions && Object.keys(sessionInfo.sessions).length > 0) {
            const addedPeers = [];
            for (let sessionNumber of Object.keys(sessionInfo.sessions)) {
                const sessionNumberInt = parseInt(sessionNumber, 10);
                if (sessionNumberInt !== sessionInfo.sessionNumber) {
                    const profile = sessionInfo.sessions[sessionNumber];
                    const user = isUserProfilePermitted ?
                        { displayName: profile.name, emailAddress: profile.email } : null;
                    addedPeers.push({
                        peerNumber: sessionNumberInt,
                        user: user,
                        role: (sessionNumberInt === 0 ? liveShare_1.Role.Host : liveShare_1.Role.Guest),
                        access: (profile.isOwner ? liveShare_1.Access.Owner : liveShare_1.Access.ReadWrite),
                    });
                }
            }
            if (addedPeers.length > 0) {
                this.currentPeers.push(...addedPeers);
                return { added: addedPeers, removed: [] };
            }
        }
        return null;
    }
    /**
     * The sharing session ended (or this user left). Notify shared services and service proxies,
     * and update current session and peers.
     */
    async onEnded(changedServices) {
        for (let s of Object.keys(this.serviceProxies)) {
            const service = this.serviceProxies[s];
            if (service.isServiceAvailable) {
                service._isServiceAvailable = false;
                changedServices.push(service);
            }
        }
        for (let s of Object.keys(this.sharedServices)) {
            const service = this.sharedServices[s];
            if (service.isServiceAvailable) {
                service._isServiceAvailable = false;
                changedServices.push(service);
            }
        }
        // Clear current session info.
        const sessionChange = this.session;
        sessionChange.peerNumber = 0;
        sessionChange.access = LiveShareApi.getSessionAccess(session_1.SessionContext.State);
        sessionChange.id = null;
        // Clear peers array.
        if (this.currentPeers.length > 0) {
            return {
                added: [],
                removed: this.currentPeers.splice(0, this.currentPeers.length),
            };
        }
        return null;
    }
    /**
     * Callback from workspace service whenever available RPC services changed.
     * We only care about prefixed services (registered via public API).
     */
    onServicesChanged(e) {
        // Filter out internal service names - the ones with no package name prefix.
        const changedServiceNames = e.serviceNames
            .filter(s => s.indexOf('.') >= 0);
        if (e.changeType === vsls.WorkspaceServicesChangeType.Add) {
            for (let s of changedServiceNames) {
                // If a proxy for the service exists, it's now available (if in Guest role).
                const serviceProxy = this.serviceProxies[s];
                if (serviceProxy && !serviceProxy.isServiceAvailable &&
                    this.session.role === liveShare_1.Role.Guest) {
                    serviceProxy._isServiceAvailable = true;
                    serviceProxy._fireIsAvailableChange();
                }
            }
        }
        else if (e.changeType === vsls.WorkspaceServicesChangeType.Remove) {
            for (let s of changedServiceNames) {
                // If a proxy for the service exists, it's now unavailable.
                const serviceProxy = this.serviceProxies[s];
                if (serviceProxy && serviceProxy.isServiceAvailable) {
                    serviceProxy._isServiceAvailable = false;
                    serviceProxy._fireIsAvailableChange();
                }
            }
        }
    }
    /**
     * Callback from workspace user service whenever participants change.
     */
    onUserSessionChanged(e) {
        if (e.sessionNumber === this.session.peerNumber) {
            // Skip notifications about myself; that's handled as part of
            // the session state change.
            return;
        }
        if (e.changeType === vsls.WorkspaceSessionChangeType.Joined) {
            const user = this.hasPermission("readUserProfile" /* readUserProfile */) ?
                { displayName: e.userProfile.name, emailAddress: e.userProfile.email } : null;
            const peer = {
                peerNumber: e.sessionNumber,
                user: user,
                role: liveShare_1.Role.Guest,
                access: liveShare_1.Access.ReadWrite,
            };
            this.currentPeers.push(peer);
            this.trace.verbose(`^onDidChangePeers(added: ${JSON.stringify(peer)})`);
            this.peersChangeEvent.fire({ added: [peer], removed: [] });
        }
        else if (e.changeType === vsls.WorkspaceSessionChangeType.Unjoined) {
            const i = this.currentPeers.findIndex(p => p.peerNumber === e.sessionNumber);
            if (i >= 0) {
                const peer = this.currentPeers.splice(i, 1)[0];
                this.trace.verbose(`^onDidChangePeers(removed: ${JSON.stringify(peer)})`);
                this.peersChangeEvent.fire({ added: [], removed: [peer] });
            }
        }
    }
    hasPermission(permission) {
        if (this.callingPackage.publisher === vslsPublisher ||
            this.callingPackage.fullName === 'WallabyJs.quokka-vscode' ||
            this.callingPackage.fullName === 'hbenl.vscode-test-explorer-liveshare') {
            // Extensions from the same publisher always have full permissions.
            return true;
        }
        if (config.featureFlags && config.featureFlags.api) {
            // Enable temporarily bypassing restrictions by setting the feature flag.
            return true;
        }
        // TODO: Look up permissions for other extensions in a static or dynamic permission list.
        return false;
    }
    sendActivatedTelemetryEvent() {
        telemetry_1.Instance.sendTelemetryEvent(telemetryStrings_1.TelemetryEventNames.ACTIVATE_EXTENSION_API, {
            [telemetryStrings_1.TelemetryPropertyNames.EXTENSION_NAME]: this.callingPackage.fullName,
            [telemetryStrings_1.TelemetryPropertyNames.EXTENSION_VERSION]: this.callingPackage.version,
            [telemetryStrings_1.TelemetryPropertyNames.EXTENSION_REQUESTED_API_VERSION]: this.apiVersion,
        });
    }
    sendInvokeCommandTelemetryEvent(commandName, options) {
        telemetry_1.Instance.sendTelemetryEvent(telemetryStrings_1.TelemetryEventNames.INVOKE_EXTENSION_COMMAND, {
            [telemetryStrings_1.TelemetryPropertyNames.EXTENSION_NAME]: this.callingPackage.fullName,
            [telemetryStrings_1.TelemetryPropertyNames.EXTENSION_VERSION]: this.callingPackage.version,
            [telemetryStrings_1.TelemetryPropertyNames.EXTENSION_INVOKED_COMMAND]: commandName,
            [telemetryStrings_1.TelemetryPropertyNames.EXTENSION_INVOKED_COMMAND_OPTIONS]: (options ? JSON.stringify(options) : ''),
        });
    }
    sendShareServiceTelemetryEvent(serviceName, isPermitted) {
        telemetry_1.Instance.sendTelemetryEvent(telemetryStrings_1.TelemetryEventNames.SHARE_EXTENSION_SERVICE, {
            [telemetryStrings_1.TelemetryPropertyNames.EXTENSION_NAME]: this.callingPackage.fullName,
            [telemetryStrings_1.TelemetryPropertyNames.EXTENSION_VERSION]: this.callingPackage.version,
            [telemetryStrings_1.TelemetryPropertyNames.EXTENSION_SERVICE_NAME]: serviceName,
            [telemetryStrings_1.TelemetryPropertyNames.EXTENSION_SERVICE_PERMITTED]: isPermitted.toString(),
        });
    }
}

//# sourceMappingURL=liveShareApi.js.map
