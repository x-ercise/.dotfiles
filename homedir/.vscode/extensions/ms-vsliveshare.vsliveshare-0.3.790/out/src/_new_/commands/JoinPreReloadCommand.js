"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const url = require("url");
const os = require("os");
const fse = require("fs-extra");
const semver = require("semver");
const config = require("../../config");
const session_1 = require("../../session");
const telemetryStrings_1 = require("../../telemetry/telemetryStrings");
const workspaceManager_1 = require("../../workspace/workspaceManager");
const ErrorNotificationCommandDecorator_1 = require("../decorators/ErrorNotificationCommandDecorator");
const TelemetryCommandDecorator_1 = require("../decorators/TelemetryCommandDecorator");
const TelemetryStatusCommandDecorator_1 = require("../decorators/TelemetryStatusCommandDecorator");
const SessionStateTransitionsCommandDecorator_1 = require("../decorators/SessionStateTransitionsCommandDecorator");
const AuthenticationCommandDecorator_1 = require("../decorators/AuthenticationCommandDecorator");
const CancellationDecorator_1 = require("../decorators/CancellationDecorator");
const ValidationCommandDecorator_1 = require("../decorators/ValidationCommandDecorator");
const joinUtilities_1 = require("../../workspace/joinUtilities");
const util_1 = require("../../util");
function builder(dependencies) {
    return new JoinPreReloadCommand(joinUtilities_1.JoinUtilities, dependencies.clipboardUtil(), workspaceManager_1.WorkspaceDefinition, workspaceManager_1.WorkspaceManager.createWorkspace, dependencies.workspaceService());
}
exports.builder = builder;
/**
 * Options that the Join command supports.
 */
class JoinPreReloadCommandOptions {
}
exports.JoinPreReloadCommandOptions = JoinPreReloadCommandOptions;
const onError = (e, context) => {
    session_1.SessionContext.notJoining();
};
// TODO: Save the command that we want to run when the reload happens
// TODO: Save the ID of the named pipe so we can reconnect to agent
/**
 * Join `command` that triggers an updates to the current workspace so
 * that the user can join a workspace.
 */
let JoinPreReloadCommand = class JoinPreReloadCommand {
    constructor(joinUtilities, clipboardUtil, workspaceDefinitionClass, createWorkspace, workspaceService) {
        this.joinUtilities = joinUtilities;
        this.clipboardUtil = clipboardUtil;
        this.workspaceDefinitionClass = workspaceDefinitionClass;
        this.createWorkspace = createWorkspace;
        this.workspaceService = workspaceService;
        this.joinLinkRegex = /https?:\/\/.*\/join\/?\?([0-9A-Z]+)/i;
        this.joinWorkspaceIdSettingName = 'vsliveshare.join.reload.workspaceId';
        this.joinWorkspaceIdFolderSettingName = 'vsliveshare.join.reload.workspaceFolder';
        this.vslsLauncherScheme = `${config.get(config.Key.scheme)}:`;
        this.vslsLinkRegex = new RegExp(`${this.vslsLauncherScheme}\?.*join.*workspaceId=([0-9A-Z-]+)`, 'i');
    }
    async invoke(options, context) {
        if (!options) {
            options = {};
        }
        const { telemetryEvent } = context;
        telemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.JOIN_WITH_LINK, (options.collaborationLink ? 'True' : 'False'));
        const workspaceInfo = await this.getWorkspaceInfo(options.collaborationLink);
        const isNewWindow = config.get(config.Key.joinInNewWindow) || (options && options.newWindow);
        const isBrokenLiveshareWorkspaceFile = this.joinUtilities.isBrokenLiveshareWorkspaceFile(vscode.workspace);
        const isEmptyWorkspace = this.joinUtilities.isEmptyWorkspace(vscode.workspace);
        const isEnteringWorkspaceSupported = semver.gte(semver.coerce(vscode.version), '1.26.0');
        if (isBrokenLiveshareWorkspaceFile && !isNewWindow) {
            telemetryEvent.addProperty('isRestoredWorkspace', true);
            await joinUtilities_1.JoinUtilities.restoreLiveshareWorkspaceState(workspaceInfo.id, workspaceInfo.name);
            return true;
        }
        session_1.SessionContext.point(telemetryStrings_1.TelemetryPropertyNames.GET_WORKSPACE_COMPLETE);
        const workspaceFolder = await this.createWorkspaceTemporaryFolder(workspaceInfo, isNewWindow);
        const workspaceFilePath = path.join(workspaceFolder, `${config.get(config.Key.name)}.code-workspace`);
        // TODO: consult with Anthony about the function injection
        await this.createWorkspace(workspaceFilePath, this.createWorkspaceDefinition(workspaceInfo, workspaceFolder));
        await this.stashConfigSettings(workspaceFilePath, telemetryEvent.getCorrelationId());
        const workspaceFileUri = vscode.Uri.file(workspaceFilePath);
        if (isEmptyWorkspace && !isBrokenLiveshareWorkspaceFile && !isNewWindow && isEnteringWorkspaceSupported) {
            telemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.JOIN_WITHOUT_RELOAD, 'True');
            vscode.commands.executeCommand('_workbench.enterWorkspace', workspaceFileUri);
        }
        else {
            // Reloads the workpace
            telemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.JOIN_WITHOUT_RELOAD, 'False');
            vscode.commands.executeCommand('vscode.openFolder', workspaceFileUri, isNewWindow);
        }
        return false;
    }
    async stashConfigSettings(workspaceFilePath, correlationId) {
        // update the config before reload
        await config.save(config.Key.joinWorkspaceLocalPath, workspaceFilePath, true, true);
        await config.save(config.Key.joinEventCorrelationId, correlationId, true, true);
        await config.save(config.Key.workspaceReloadTime, Date.now(), true);
    }
    createWorkspaceDefinition(workspaceInfo, workspaceFolder) {
        const workspaceDefinition = new this.workspaceDefinitionClass();
        workspaceDefinition.folders.push({
            uri: `${this.vslsLauncherScheme}/`,
            name: (workspaceInfo.name || 'Loading file tree...')
        });
        workspaceDefinition.settings = {
            [this.joinWorkspaceIdSettingName]: workspaceInfo.id,
            [this.joinWorkspaceIdFolderSettingName]: workspaceFolder,
            ['files.hotExit']: 'off'
        };
        return workspaceDefinition;
    }
    async createWorkspaceTemporaryFolder(workspaceInfo, isNewWindow) {
        let workspaceFolder = path.join(os.tmpdir(), `tmp-${workspaceInfo.id}`);
        if (isNewWindow) {
            workspaceFolder += `_${Date.now()}`;
        }
        await fse.ensureDir(workspaceFolder);
        return workspaceFolder;
    }
    async getWorkspaceInfo(collaborationLink) {
        collaborationLink = await this.getCollaborationLink(collaborationLink);
        const workspaceInfo = await this.getValidWorkspaceFromLink(collaborationLink);
        if (!workspaceInfo) {
            throw new Error('The collaboration session is not found. Please check the link provided by the host and try again.');
        }
        return workspaceInfo;
    }
    async getCollaborationLink(collaborationLink) {
        if (!collaborationLink) {
            let clipboardValue = '';
            try {
                clipboardValue = this.clipboardUtil.pasteFromClipboard().trim();
            }
            catch (e) { }
            collaborationLink = await vscode.window.showInputBox({
                prompt: 'Enter a link to a workspace to join',
                ignoreFocusOut: true,
                value: this.extractLiveshareLink(clipboardValue)
            });
            if (!collaborationLink) {
                // The user cancelled out of the input dialog.
                throw new util_1.CancellationError('The join link input is empty.');
            }
        }
        return collaborationLink.toString().trim();
    }
    extractLiveshareWorkspaceId(joinCollaborationLink = '') {
        const { linkMatch, cascadeMatch } = this.getLiveshareLinkMatch(joinCollaborationLink);
        return (linkMatch && linkMatch[1]) || (cascadeMatch && cascadeMatch[1]);
    }
    getLiveshareLinkMatch(joinCollaborationLink = '') {
        return {
            linkMatch: this.joinLinkRegex.exec(joinCollaborationLink),
            cascadeMatch: this.vslsLinkRegex.exec(joinCollaborationLink)
        };
    }
    extractLiveshareLink(joinCollaborationLink = '') {
        const { linkMatch, cascadeMatch } = this.getLiveshareLinkMatch(joinCollaborationLink);
        return (linkMatch && linkMatch[0]) || (cascadeMatch && cascadeMatch[0]);
    }
    async getValidWorkspaceFromLink(collaborationLink) {
        const liveshareLink = this.extractLiveshareLink(collaborationLink);
        if (!liveshareLink) {
            throw new Error('The specified value isn’t a valid Live Share URL. Please check the link provided by the host and try again.');
        }
        const workspaceId = this.extractLiveshareWorkspaceId(liveshareLink);
        const workspace = await this.workspaceService.getWorkspaceAsync(workspaceId);
        if (!workspace || !workspace.joinUri) {
            // No workspace or joinUri found - handle the error from the caller
            return undefined;
        }
        const { hostname: linkHostname } = url.parse(collaborationLink);
        const { hostname: workspaceHostname } = url.parse(workspace.joinUri);
        if (linkHostname !== workspaceHostname) {
            throw new Error('The specified hostname isn’t a valid Live Share URL. Please check the link provided by the host and try again.');
        }
        return workspace;
    }
};
JoinPreReloadCommand = __decorate([
    CancellationDecorator_1.cancellationDecorator(),
    ErrorNotificationCommandDecorator_1.errorNotificationCommandDecorator('Joining workspace', telemetryStrings_1.TelemetryEventNames.JOIN_FAULT, onError),
    TelemetryCommandDecorator_1.telemetryCommandDecorator(telemetryStrings_1.TelemetryEventNames.JOIN_WORKSPACE, telemetryStrings_1.TelemetryEventNames.JOIN_FAULT, 'Join', 1),
    TelemetryStatusCommandDecorator_1.telemetryStatusCommandDecorator(),
    ValidationCommandDecorator_1.validationCommandDecorator(),
    SessionStateTransitionsCommandDecorator_1.sessionStateTransitionsCommandDecorator(session_1.SessionAction.AttemptJoining, session_1.SessionAction.JoiningPendingReload, session_1.SessionAction.JoiningError),
    AuthenticationCommandDecorator_1.authenticationCommandDecorator(session_1.SessionAction.AttemptJoining, 2)
], JoinPreReloadCommand);
exports.JoinPreReloadCommand = JoinPreReloadCommand;

//# sourceMappingURL=JoinPreReloadCommand.js.map
