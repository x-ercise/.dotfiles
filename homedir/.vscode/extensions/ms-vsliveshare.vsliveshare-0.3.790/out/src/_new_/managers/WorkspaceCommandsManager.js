"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const util_1 = require("../../util");
const session_1 = require("../../session");
const commands_1 = require("../../commands");
function unPinAndFollowToTheSide(clientId) {
    session_1.SessionContext.coeditingClient.unpinByClient(clientId);
    session_1.SessionContext.coeditingClient.pin(null, clientId, true);
}
class WorkspaceCommandsManager {
    async init() {
        await util_1.ExtensionUtil.tryRegisterCommand(commands_1.Commands.pinCommandId, this.pinWithParticipantPrompt, this, /* isEditorCommand */ false);
        await util_1.ExtensionUtil.tryRegisterCommand(commands_1.Commands.followToTheSideCommandId, this.followToTheSide, this, /* isEditorCommand */ false);
        await util_1.ExtensionUtil.tryRegisterCommand(commands_1.Commands.followToTheSideActivityBarCommandId, this.followToTheSideSpecificUser, this, /* isEditorCommand */ false);
        await util_1.ExtensionUtil.tryRegisterCommand(commands_1.Commands.followToTheSideTreeExplorerCommandId, this.followToTheSideSpecificUser, this, /* isEditorCommand */ false);
        await util_1.ExtensionUtil.tryRegisterCommand(commands_1.Commands.pinFromFileTreeExplorerCommandId, this.followSpecificUser, this, /* isEditorCommand */ false);
        await util_1.ExtensionUtil.tryRegisterCommand(commands_1.Commands.pinFromActivityBarCommandId, this.followSpecificUser, this, /* isEditorCommand */ false);
        await util_1.ExtensionUtil.tryRegisterCommand(commands_1.Commands.unpinCommandId, this.unpinCommandHandler, this, /* isEditorCommand */ true);
        await util_1.ExtensionUtil.tryRegisterCommand(commands_1.Commands.unpinFromFileTreeExplorerCommandId, this.unpinCommandHandler, this, /* isEditorCommand */ true);
        await util_1.ExtensionUtil.tryRegisterCommand(commands_1.Commands.unpinFromActivityBarCommandId, this.unpinCommandHandler, this, /* isEditorCommand */ true);
    }
    async dispose() {
        util_1.ExtensionUtil.disposeCommand(commands_1.Commands.pinCommandId);
        util_1.ExtensionUtil.disposeCommand(commands_1.Commands.pinFromFileTreeExplorerCommandId);
        util_1.ExtensionUtil.disposeCommand(commands_1.Commands.pinFromActivityBarCommandId);
        util_1.ExtensionUtil.disposeCommand(commands_1.Commands.unpinCommandId);
        util_1.ExtensionUtil.disposeCommand(commands_1.Commands.unpinFromFileTreeExplorerCommandId);
        util_1.ExtensionUtil.disposeCommand(commands_1.Commands.unpinFromActivityBarCommandId);
    }
    async followToTheSide() {
        if (!WorkspaceCommandsManager.getCollaboratorsIfWeHaveSome()) {
            return;
        }
        if (!vscode.window.activeTextEditor) {
            return this.pinWithParticipantPrompt(false);
        }
        let clientId = session_1.SessionContext.coeditingClient.getClientIdIfEditorIsPinned(vscode.window.activeTextEditor);
        if (clientId === -1) {
            clientId = await this.promptForParticpentsToFollow(false);
        }
        if (clientId === -1) {
            return;
        }
        unPinAndFollowToTheSide(clientId);
    }
    followToTheSideSpecificUser(user) {
        unPinAndFollowToTheSide(user.sessionId);
    }
    followSpecificUser(user) {
        this.pinWithParticipantPrompt(user);
    }
    async pinWithParticipantPrompt(arg) {
        const coEditors = WorkspaceCommandsManager.getCollaboratorsIfWeHaveSome();
        if (!coEditors) {
            return;
        }
        // This specific command is hooked up to the editor directly, and can
        // be called with a parameter. In the second case it's a bool -- easy!
        // But in the first case it's a URI. We don't do anything with URI's so
        // its not useful. Lets do a typecheck to make sure we handle this
        // correctly
        let alwaysShowParticipants = false;
        if (typeof arg === 'boolean') {
            alwaysShowParticipants = arg;
        }
        let targetClient = coEditors[0]; // Default to first participant
        if (coEditors.length > 1 || alwaysShowParticipants) {
            // if we have only 1 editor, theres no point in prompting. However,
            // there are times we use the list to inform people who is in the session
            // not just pin.
            targetClient = await this.promptForParticpentsToFollow(alwaysShowParticipants);
        }
        if (targetClient === -1) {
            return;
        }
        await session_1.SessionContext.coeditingClient.pin(null, targetClient);
    }
    async promptForParticpentsToFollow(alwaysShowParticipants) {
        const coEditors = WorkspaceCommandsManager.getCollaboratorsIfWeHaveSome();
        if (!coEditors) {
            return -1;
        }
        const placeHolder = alwaysShowParticipants
            ? coEditors.length + ' participant location(s) listed below. Select one to follow or press \'Escape\' when done.'
            : 'Select a participant to follow';
        const picks = coEditors.map((sessionId) => {
            const displayName = session_1.SessionContext.collaboratorManager.getDisplayName(sessionId);
            const lastKnownFile = session_1.SessionContext.coeditingClient.lastKnownFileForClient(sessionId);
            return {
                description: displayName,
                detail: lastKnownFile ? `Currently editing ${lastKnownFile}` : 'Not currently editing a shared document',
                label: '$(file-symlink-file)',
                targetSessionId: sessionId
            };
        });
        const pick = await vscode.window.showQuickPick(picks, { placeHolder });
        if (!pick) {
            return -1;
        }
        return pick.targetSessionId;
    }
    async unpinCommandHandler(textEditor, edit, args) {
        if (!session_1.SessionContext.coeditingClient) {
            return;
        }
        session_1.SessionContext.coeditingClient.unpinByEditor(textEditor, /* explicit */ true);
    }
    static getCollaboratorsIfWeHaveSome() {
        if (!session_1.SessionContext.coeditingClient || !session_1.SessionContext.collaboratorManager) {
            return;
        }
        const coEditors = session_1.SessionContext.collaboratorManager.getCollaboratorSessionIds();
        const coEditorCount = coEditors.length;
        if (coEditorCount < 1) {
            return;
        }
        return coEditors;
    }
}
exports.WorkspaceCommandsManager = WorkspaceCommandsManager;

//# sourceMappingURL=WorkspaceCommandsManager.js.map
