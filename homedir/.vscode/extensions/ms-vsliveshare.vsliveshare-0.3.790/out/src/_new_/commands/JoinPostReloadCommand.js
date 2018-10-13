"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const vsls = require("../../contracts/VSLS");
const config = require("../../config");
const util = require("../../util");
const session_1 = require("../../session");
const telemetry_1 = require("../../telemetry/telemetry");
const telemetryStrings_1 = require("../../telemetry/telemetryStrings");
const ErrorNotificationCommandDecorator_1 = require("../decorators/ErrorNotificationCommandDecorator");
const TelemetryCommandDecorator_1 = require("../decorators/TelemetryCommandDecorator");
const TelemetryStatusCommandDecorator_1 = require("../decorators/TelemetryStatusCommandDecorator");
const SessionStateTransitionsCommandDecorator_1 = require("../decorators/SessionStateTransitionsCommandDecorator");
const AuthenticationCommandDecorator_1 = require("../decorators/AuthenticationCommandDecorator");
const CancellationDecorator_1 = require("../decorators/CancellationDecorator");
const ValidationCommandDecorator_1 = require("../decorators/ValidationCommandDecorator");
const ProgressCommandDecorator_1 = require("../decorators/ProgressCommandDecorator");
const joinUtilities_1 = require("../../workspace/joinUtilities");
const CommandBase_1 = require("./CommandBase");
function builder(dependencies) {
    return new JoinReloadCommand(dependencies.sessionContext(), dependencies.workspaceService(), dependencies.coEditingGuestManager(), dependencies.workspaceCommandManager(), dependencies.joinedCommandManager(), dependencies.accessControlManager(), dependencies.searchProviderManager(), dependencies.additionalRootsManager(), dependencies.joinDebugManagerFacade(), dependencies.joinBreakpointManager(), dependencies.workspaceTaskClientManager());
}
exports.builder = builder;
const onError = (e, context) => {
    session_1.SessionContext.notJoining();
    vscode.commands.executeCommand('workbench.action.closeFolder');
};
const onErrorTelemetry = (e, context) => {
    const { telemetryEvent } = context;
    if (telemetryEvent) {
        switch (e.code) {
            case vsls.ErrorCodes.CollaborationSessionGuestRejected: {
                telemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.REJECTED_BY_HOST, true);
                break;
            }
            case vsls.ErrorCodes.CollaborationSessionGuestCanceled: {
                telemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.GUEST_CANCELED, true);
                break;
            }
            case vsls.ErrorCodes.CollaborationSessionRequestTimedOut: {
                telemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.JOIN_REQUEST_TIMED_OUT, true);
                break;
            }
            case vsls.ErrorCodes.CollaborationSessionNotFound: {
                telemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.WORKSPACE_NOT_FOUND, true);
                break;
            }
            default: { }
        }
    }
};
/**
 * Join reload `command` that triggers when we know what workspace we
 * are connecting to (typically happens from a bank/empty workspace or
 * a newly opened copy of VS Code).
 */
let JoinReloadCommand = class JoinReloadCommand extends CommandBase_1.CommandBase {
    constructor(sessionContext, workspaceService, coEditingGuestManager, workspaceCommandManager, joinedCommandManager, accessControlManager, searchProviderManager, additionalRootsManager, joinDebugManagerFacade, joinBreakpointManager, workspaceTaskClientManager) {
        super();
        this.sessionContext = sessionContext;
        this.workspaceService = workspaceService;
        this.postSetupManagers.push({ status: telemetryStrings_1.TelemetryPropertyNames.INIT_ACCESS_CONTROL_COMPLETE, instance: accessControlManager }, { status: telemetryStrings_1.TelemetryPropertyNames.ADD_ADDITIONALROOTS_COMPLETE, instance: additionalRootsManager }, { status: telemetryStrings_1.TelemetryPropertyNames.INIT_COEDITING_COMPLETE, instance: coEditingGuestManager }, { status: telemetryStrings_1.TelemetryPropertyNames.INIT_COMMAND_COMPLETE, instance: workspaceCommandManager }, 
        // TODO: get more cases like the `joinedCommandManager` where we effectively just want
        // to run something inbetween the command managers and generalize(one option is a generic "callback" manager)
        { status: telemetryStrings_1.TelemetryPropertyNames.JOIN_WORKSPACE_COMPLETE, instance: joinedCommandManager }, { status: telemetryStrings_1.TelemetryPropertyNames.INIT_SEARCHPROVIDER_COMPLETE, instance: searchProviderManager }, { status: telemetryStrings_1.TelemetryPropertyNames.INIT_DEBUGGING_COMPLETE, instance: joinDebugManagerFacade }, { status: telemetryStrings_1.TelemetryPropertyNames.INIT_BREAKPOINT_COMPLETE, instance: joinBreakpointManager }, { status: telemetryStrings_1.TelemetryPropertyNames.RELOAD_END_TIME, instance: workspaceTaskClientManager });
    }
    async invoke(options, context) {
        const { cancellationTokenSource, telemetryEvent } = context;
        this.addInitialTelemetryProperties(telemetryEvent);
        this.registerForDisposingWorkspaceFile();
        await this.resetConfigProperties();
        await joinUtilities_1.JoinUtilities.applyGuestSettingsToWorkspace();
        const workspaceSessionInfo = await this.workspaceService.joinWorkspaceAsync(this.createWorksapceInfo(options), cancellationTokenSource && cancellationTokenSource.token);
        // it is important to set the `workspaceSessionInfo` to the `sessionContext` before we call the `postSetupMangers` as they rely on it
        this.sessionContext.workspaceSessionInfo = workspaceSessionInfo;
        this.invokePostSetupManagers(this.sessionContext);
        this.addWorkspaceSessionInfoTelemetryProperties(telemetryEvent, workspaceSessionInfo);
        return true;
    }
    addWorkspaceSessionInfoTelemetryProperties(telemetryEvent, workspaceSessionInfo) {
        telemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.CREATED_AT, workspaceSessionInfo.createdAt);
        telemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.UPDATED_AT, workspaceSessionInfo.updatedAt);
        telemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.CONNECTION_MODE_USED, workspaceSessionInfo.connectionMode);
    }
    createWorksapceInfo(options) {
        return {
            id: options.workspaceId,
            connectionMode: config.get(config.Key.connectionMode),
            clientCapabilities: config.getClientCapabilties(),
        };
    }
    addInitialTelemetryProperties(telemetryEvent) {
        telemetry_1.Instance.setCorrelationEvent(telemetryEvent);
        const correlationId = config.get(config.Key.joinEventCorrelationId);
        if (correlationId) {
            telemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.JOIN_FROM_BROWSER, 'False');
            telemetryEvent.correlateWithId(correlationId);
            telemetryEvent.addMeasure(telemetryStrings_1.TelemetryPropertyNames.RELOAD_START_TIME, config.get(config.Key.workspaceReloadTime));
            telemetryEvent.addMeasure(telemetryStrings_1.TelemetryPropertyNames.RELOAD_RESUMED_TIME, (new Date()).getTime());
        }
        else {
            telemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.JOIN_FROM_BROWSER, 'True');
        }
    }
    registerForDisposingWorkspaceFile() {
        // On extension `deactivation`, register to delete the temporary workspace file
        const currentWorkspacePath = config.get(config.Key.joinWorkspaceLocalPath);
        util.ExtensionUtil.disposeOnUnload([currentWorkspacePath]);
        vscode.commands.executeCommand('vscode.removeFromRecentlyOpened', currentWorkspacePath);
    }
    /**
     * Function to clear the config properties stashed before reload.
     */
    async resetConfigProperties() {
        // Clear things stashed before during reload
        await config.save(config.Key.joinWorkspaceLocalPath, undefined, true, true);
        await config.save(config.Key.joinEventCorrelationId, undefined, true, true);
        await config.save(config.Key.workspaceReloadTime, undefined, true);
    }
};
JoinReloadCommand = __decorate([
    CancellationDecorator_1.cancellationDecorator(),
    ErrorNotificationCommandDecorator_1.errorNotificationCommandDecorator('Joining workspace', telemetryStrings_1.TelemetryEventNames.JOIN_FAULT, onError),
    TelemetryCommandDecorator_1.telemetryCommandDecorator(telemetryStrings_1.TelemetryEventNames.WORKSPACE_RELOAD, telemetryStrings_1.TelemetryEventNames.JOIN_FAULT, 'Join', 1, onErrorTelemetry),
    TelemetryStatusCommandDecorator_1.telemetryStatusCommandDecorator(),
    ValidationCommandDecorator_1.validationCommandDecorator(),
    ProgressCommandDecorator_1.progressCommandDecorator(),
    SessionStateTransitionsCommandDecorator_1.sessionStateTransitionsCommandDecorator(null, session_1.SessionAction.JoiningSuccess, session_1.SessionAction.JoiningError),
    AuthenticationCommandDecorator_1.authenticationCommandDecorator(session_1.SessionAction.AttemptJoining, 2)
], JoinReloadCommand);
exports.JoinReloadCommand = JoinReloadCommand;

//# sourceMappingURL=JoinPostReloadCommand.js.map
