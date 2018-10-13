//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const url = require("url");
const semver = require("semver");
const ic = require("./internalConfig");
const mc = require("./mementoConfig");
const util_1 = require("./util");
var Key;
(function (Key) {
    // PUBLIC SETTINGS
    Key["features"] = "features";
    Key["diagnosticLogging"] = "diagnosticLogging";
    Key["accountProvider"] = "accountProvider";
    Key["account"] = "account";
    Key["connectionMode"] = "connectionMode";
    Key["joinDebugSessionOption"] = "joinDebugSessionOption";
    Key["allowGuestDebugControl"] = "allowGuestDebugControl";
    Key["nameTagVisibility"] = "nameTagVisibility";
    Key["guestApprovalRequired"] = "guestApprovalRequired";
    Key["excludedDebugTypes"] = "excludedDebugTypes";
    Key["keepAliveInterval"] = "keepAliveInterval";
    Key["showInStatusBar"] = "showInStatusBar";
    Key["allowGuestTaskControl"] = "allowGuestTaskControl";
    Key["allowGuestCommandControl"] = "languages.allowGuestCommandControl";
    Key["focusBehavior"] = "focusBehavior";
    Key["showReadOnlyUsersInEditor"] = "showReadOnlyUsersInEditor";
    Key["increasedGuestLimit"] = "increasedGuestLimit";
    Key["autoShareTerminals"] = "autoShareTerminals";
    // PRIVATE SETTINGS
    Key["joinWorkspaceLocalPath"] = "joinWorkspaceLocalPath";
    Key["agentUri"] = "agentUri";
    Key["serviceUri"] = "serviceUri";
    Key["joinInNewWindow"] = "joinInNewWindow";
    Key["registrationUri"] = "registrationUri";
    Key["showLauncherInstallNotification"] = "showLauncherInstallNotification";
    Key["showLauncherError"] = "showLauncherError";
    Key["joinEventCorrelationId"] = "joinEventCorrelationId";
    Key["workspaceReloadTime"] = "workspaceReloadTime";
    Key["userSettingsPath"] = "userSettingsPath";
    Key["name"] = "name";
    Key["shortName"] = "shortName";
    Key["abbreviation"] = "abbreviation";
    Key["licenseUrl"] = "licenseUrl";
    Key["privacyUrl"] = "privacyUrl";
    Key["configName"] = "configName";
    Key["authority"] = "authority";
    Key["scheme"] = "scheme";
    Key["agent"] = "agent";
    Key["commandPrefix"] = "commandPrefix";
    Key["launcherName"] = "launcherName";
    Key["userEmail"] = "userEmail";
    Key["isInternal"] = "isInternal";
    Key["canCollectPII"] = "canCollectPII";
    Key["teamStatus"] = "teamStatus";
    Key["isShareLocalServerHintDisplayed"] = "isShareLocalServerHintDisplayed";
    Key["debugAdapters"] = "debugAdapters";
    Key["sessionCount"] = "sessionCount";
    Key["gitHubUri"] = "gitHubUri";
    Key["experimentalFeatures"] = "experimentalFeatures";
    Key["sharedTerminalWindow"] = "sharedTerminalWindow";
    Key["sharedTerminalWidth"] = "sharedTerminalWidth";
    Key["sharedTerminalHeight"] = "sharedTerminalHeight";
    Key["shareDebugTerminal"] = "shareDebugTerminal";
    Key["debugAdapter"] = "debugAdapter";
    Key["debugHostAdapter"] = "debugHostAdapter";
    Key["suppressFirewallPrompts"] = "suppressFirewallPrompts";
    Key["traceFilters"] = "traceFilters";
    Key["whatsNewUri"] = "whatsNewUri";
    Key["whatsNewText"] = "whatsNewText";
    Key["textSearchResultsLimit"] = "textSearchResultsLimit";
    Key["textSearchPreviewLimit"] = "textSearchPreviewLimit";
    Key["logTelemetry"] = "logTelemetry";
    // MEMENTO SETTINGS
    Key["isWelcomePageDisplayed"] = "isWelcomePageDisplayed";
    Key["firstActivationVersion"] = "firstActivationVersion";
    Key["dontRequestFeedback"] = "dontRequestFeedback";
    Key["dontRequestAdditionalFeedback"] = "dontRequestAdditionalFeedback";
})(Key = exports.Key || (exports.Key = {}));
const privateSettings = [
    Key.joinWorkspaceLocalPath,
    Key.agentUri,
    Key.serviceUri,
    Key.joinInNewWindow,
    Key.registrationUri,
    Key.showLauncherInstallNotification,
    Key.showLauncherError,
    Key.joinEventCorrelationId,
    Key.workspaceReloadTime,
    Key.userSettingsPath,
    Key.name,
    Key.shortName,
    Key.abbreviation,
    Key.licenseUrl,
    Key.privacyUrl,
    Key.configName,
    Key.authority,
    Key.scheme,
    Key.agent,
    Key.commandPrefix,
    Key.launcherName,
    Key.userEmail,
    Key.isInternal,
    Key.canCollectPII,
    Key.teamStatus,
    Key.isShareLocalServerHintDisplayed,
    Key.debugAdapters,
    Key.sessionCount,
    Key.gitHubUri,
    Key.debugAdapter,
    Key.debugHostAdapter,
    Key.suppressFirewallPrompts,
    Key.experimentalFeatures,
    Key.traceFilters,
    Key.whatsNewUri,
    Key.whatsNewText,
    Key.textSearchResultsLimit,
    Key.textSearchPreviewLimit,
    Key.logTelemetry
];
const mementoSettings = [
    Key.isWelcomePageDisplayed,
    Key.firstActivationVersion,
    Key.dontRequestFeedback,
    Key.dontRequestAdditionalFeedback
];
var FeatureSet;
(function (FeatureSet) {
    FeatureSet["defaultFeatures"] = "default";
    FeatureSet["stable"] = "stable";
    FeatureSet["experimental"] = "experimental";
})(FeatureSet = exports.FeatureSet || (exports.FeatureSet = {}));
exports.featureFlags = {
    lsp: true,
    multiGuestLsp: true,
    api: false,
    sharedTerminals: true,
    localUndo: true,
    localRedo: false,
    workspaceTask: true,
    summonParticipants: true,
    guestApproval: true,
    newFileProvider: true,
    shareDebugTerminal: true,
    verticalScrolling: true,
    findFiles: true,
    multiRootWorkspaceVSCode: true,
    multiRootWorkspaceVSIDE: false,
    searchInSolutionExplorer: false,
    strongFollowBehavior: false,
    textSearch: true,
    showExplorer: true,
    accessControl: true,
    newShareCommand: false,
};
const experimentalFeatures = {
    lsp: true,
    multiGuestLsp: true,
    api: true,
    sharedTerminals: true,
    localUndo: true,
    localRedo: true,
    workspaceTask: true,
    summonParticipants: true,
    guestApproval: true,
    newFileProvider: true,
    shareDebugTerminal: true,
    verticalScrolling: true,
    findFiles: true,
    multiRootWorkspaceVSCode: true,
    multiRootWorkspaceVSIDE: false,
    searchInSolutionExplorer: false,
    strongFollowBehavior: true,
    textSearch: true,
    showExplorer: true,
    accessControl: true,
    newShareCommand: true,
};
function isPrivateKey(key) {
    return privateSettings.indexOf(key) >= 0;
}
function isMementoKey(key) {
    return mementoSettings.indexOf(key) >= 0;
}
async function initAsync(context) {
    await ic.InternalConfig.initAsync(context, Key[Key.userSettingsPath]);
    await mc.MementoConfig.initAsync(context);
    if (isExperimentalFeatureSet()) {
        Object.assign(exports.featureFlags, experimentalFeatures);
    }
    Object.assign(exports.featureFlags, get(Key.experimentalFeatures));
    // Add defined feature flags to vscode command context
    for (const flag in exports.featureFlags) {
        if (exports.featureFlags.hasOwnProperty(flag)) {
            const flagValue = exports.featureFlags[flag];
            if (typeof flagValue !== 'undefined' && flagValue !== null) {
                util_1.ExtensionUtil.setCommandContext(`liveshare:feature:${flag}`, flagValue);
            }
        }
    }
}
exports.initAsync = initAsync;
function save(key, value, global = true, delaySaveToDisk = false) {
    if (isPrivateKey(key)) {
        return ic.InternalConfig.save(key, value, delaySaveToDisk);
    }
    if (isMementoKey(key)) {
        return mc.MementoConfig.save(key, value);
    }
    let extensionConfig = vscode.workspace.getConfiguration(get(Key.configName));
    if (global && value === undefined &&
        extensionConfig.inspect(key).globalValue === undefined) {
        // Trying to remove a global value that doesn't exist throws an exception.
        return;
    }
    return extensionConfig.update(key, value, global);
}
exports.save = save;
function get(key) {
    if (isPrivateKey(key)) {
        return ic.InternalConfig.get(key);
    }
    if (isMementoKey(key)) {
        return mc.MementoConfig.get(key);
    }
    let extensionConfig = vscode.workspace.getConfiguration(get(Key.configName));
    return extensionConfig.get(key);
}
exports.get = get;
function getUserSettings() {
    const userSettings = ic.InternalConfig.getUserSettings();
    userSettings.experimentalFeatures = exports.featureFlags;
    userSettings.increasedGuestLimit = get(Key.increasedGuestLimit);
    return userSettings;
}
exports.getUserSettings = getUserSettings;
function getUri(key) {
    if (isPrivateKey(key)) {
        return ic.InternalConfig.getUri(key);
    }
    if (isMementoKey(key)) {
        return mc.MementoConfig.getUri(key);
    }
    let value = get(key);
    if (!value) {
        return null;
    }
    try {
        return url.parse(value);
    }
    catch (e) {
        return null;
    }
}
exports.getUri = getUri;
function getClientCapabilties() {
    return {
        extensionReadOnlySupport: exports.featureFlags.accessControl,
        clientReadOnlySupport: semver.gte(semver.coerce(vscode.version), '1.25.1'),
    };
}
exports.getClientCapabilties = getClientCapabilties;
function isVSLSTeamMember() {
    return !!get(Key.teamStatus);
}
exports.isVSLSTeamMember = isVSLSTeamMember;
function isExperimentalFeatureSet() {
    const featureSet = FeatureSet[get(Key.features)];
    const isInternal = !!get(Key.isInternal);
    const isExperimental = (featureSet === FeatureSet.experimental);
    const isStable = (featureSet === FeatureSet.stable);
    if (isExperimental) {
        return true;
    }
    if (isStable) {
        return false;
    }
    return isInternal;
}
exports.isExperimentalFeatureSet = isExperimentalFeatureSet;

//# sourceMappingURL=config.js.map
