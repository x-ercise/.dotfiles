"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const semver = require("semver");
const config = require("../../config");
const vsls = require("../../contracts/VSLS");
const sessionTypes_1 = require("../../sessionTypes");
const util_1 = require("../../util");
/**
 * Provider that manages progress notifier in the context of a
 * command.
 */
class ProgressNotifierUtil {
    constructor(sessionContext, notificationUtil, contextUtil, workspaceService, trace) {
        this.sessionContext = sessionContext;
        this.notificationUtil = notificationUtil;
        this.contextUtil = contextUtil;
        this.workspaceService = workspaceService;
        this.trace = trace;
    }
    async create(options, commandCancellationToken, task) {
        const index = ProgressNotifierUtil.correlationIndex++;
        this.trace.info(`Progress notifier opened: ${index}.`);
        const location = semver.gte(semver.coerce(vscode.version), '1.22.0')
            ? vscode.ProgressLocation.Notification
            : vscode.ProgressLocation.Window;
        return await this.notificationUtil.withProgress({ title: options.title, cancellable: true, location }, async (progress, progressUIcancellationToken) => {
            const stateCallback = (newState, previousState) => {
                const message = this.generateMessage(sessionTypes_1.SessionState[newState]);
                progress.report({ message });
            };
            const isDiagnosticLogging = config.get(config.Key.diagnosticLogging);
            const statusCallback = (newStatus, previousState) => {
                const message = this.generateMessage(newStatus);
                progress.report({ message });
            };
            this.sessionContext.addListener(sessionTypes_1.SessionEvents.StateChanged, stateCallback);
            if (isDiagnosticLogging) {
                this.sessionContext.addListener(sessionTypes_1.SessionEvents.StatusChanged, statusCallback);
            }
            const unsubscribe = () => {
                this.sessionContext.removeListener(sessionTypes_1.SessionEvents.StateChanged, stateCallback);
                if (isDiagnosticLogging) {
                    this.sessionContext.removeListener(sessionTypes_1.SessionEvents.StatusChanged, statusCallback);
                }
            };
            if (progressUIcancellationToken) {
                progressUIcancellationToken.onCancellationRequested(() => {
                    this.trace.info(`Progress notifier cancelled: ${index}.`);
                    unsubscribe();
                });
            }
            if (commandCancellationToken) {
                commandCancellationToken.onCancellationRequested(() => {
                    this.trace.info(`Progress notifier cancelled by command: ${index}.`);
                    unsubscribe();
                });
            }
            this.workspaceService.onProgressUpdated(this.onWorkspaceProgressUpdated.bind(this, progress));
            const result = await task(progressUIcancellationToken);
            this.trace.info(`Progress notifier finished: ${index}.`);
            unsubscribe();
            return result;
        });
    }
    onWorkspaceProgressUpdated(progress, e) {
        switch (e.progress) {
            case vsls.WorkspaceProgress.WaitingForHost: {
                progress.report({ message: util_1.ExtensionUtil.getProgressUpdateString(e.progress) });
                break;
            }
            case vsls.WorkspaceProgress.OpeningRemoteSession:
            case vsls.WorkspaceProgress.JoiningRemoteSession: {
                progress.report({ message: util_1.ExtensionUtil.getProgressUpdateString(e.progress) });
                break;
            }
            default: { }
        }
    }
    generateMessage(status) {
        if (status === sessionTypes_1.SessionState[sessionTypes_1.SessionState.ExternallySigningIn]) {
            return `Sign-in to proceed.`;
        }
        // do not show sharing in progress status as it results in `Sharing workspace: Shariong in Progress` which is redundant,
        // the `Sharing workspace` is already sufficient
        if (status === sessionTypes_1.SessionState[sessionTypes_1.SessionState.SharingInProgress] || status === sessionTypes_1.SessionState[sessionTypes_1.SessionState.JoiningInProgress]) {
            return undefined;
        }
        return status
            ? this.contextUtil.scrubPrefix(status)
                .match(ProgressNotifierUtil.statusTextGeneratorRegex)
                .slice(0, -1)
                .join(' ')
            : status;
    }
}
ProgressNotifierUtil.statusTextGeneratorRegex = /([A-Z]?[^A-Z]*)/g;
ProgressNotifierUtil.correlationIndex = 0;
exports.ProgressNotifierUtil = ProgressNotifierUtil;

//# sourceMappingURL=ProgressNotifierUtil.js.map
