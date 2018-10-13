"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
const vscode = require("vscode");
const traceSource_1 = require("../tracing/traceSource");
const vsls = require("../contracts/VSLS");
const VSLS_1 = require("../contracts/VSLS");
const coauthoringService_1 = require("./common/coauthoringService");
const pathManager_1 = require("../languageService/pathManager");
const events_1 = require("events");
const vscodeBufferManager_1 = require("./client/vscodeBufferManager");
const util_1 = require("../util");
const decorators_1 = require("./client/decorators");
const config = require("../config");
const positionTracker_1 = require("./client/positionTracker");
const session_1 = require("../session");
const collabBuffer_1 = require("./common/collabBuffer");
const commands_1 = require("../commands");
const coauthoringTelemetry_1 = require("../telemetry/coauthoringTelemetry");
const extension_1 = require("../extension");
const semaphore_async_await_1 = require("semaphore-async-await");
const fs = require("fs");
const telemetry_1 = require("../telemetry/telemetry");
const formatPath = traceSource_1.TraceFormat.formatPath;
const initialSelectionNotificationDelay = 500;
function getEditorId(editor) {
    // The only way to accurately compare text editors when they move across viewcolumns is through their internal
    // "id" property. This is potentially dangerous, as internal properties may change (they are not officially part of
    // the VS Code API).
    return editor.id;
}
// This is a helper implementation of undoing the buffer until it reaches desired
// buffer content. Of note, this is based on the assumption that the remote edits
// are actually creating a 'undo stop' in the Code undo stack. A the time of
// authoring, this was true -- by observation & code inspection.
// Also, of note, that if the window looses focus, and there is no focused
// editor when this happens, nothing changes, and we'll keep calling the undo
// command. There is no indication that is did or didn't perform an operation,
// so this is very much a hope that something happens.
// Additionally, of note, VS Code's undo implementation is pretty much fire-and
// -forget; it does it irrespective of anything to undo.
function stepUndoTillContentMatches(checkpoint, doc, trace, onComplete) {
    return new Promise((resolve, reject) => {
        const docVersionBeforeUndo = doc.version;
        vscode.commands.executeCommand('default:undo').then(() => {
            let documentContent = doc.getText();
            let docVersionAfterUndo = doc.version;
            // If content doesn't match, clearly got more to go. However if the
            // document version didn't change, nothing really got undo, so there
            // is no point in continuing.
            if (documentContent !== checkpoint && (docVersionBeforeUndo !== docVersionAfterUndo)) {
                setImmediate(() => {
                    stepUndoTillContentMatches(checkpoint, doc, trace, onComplete || resolve);
                });
                return;
            }
            if (docVersionBeforeUndo === docVersionAfterUndo) {
                trace.verbose('Undo: Performing undo didn\'t actually make changes');
            }
            if (onComplete) {
                onComplete();
            }
            else {
                resolve();
            }
        });
    });
}
// Given a set of file change events, determines if they might represent a rename
// and returns the old & new file names if it is something that resembles a rename
function getFileNamesFromRenameFileChange(changes) {
    if (!changes || changes.length !== 2) {
        return;
    }
    let oldName;
    let newName;
    changes.forEach((change) => {
        const changePath = util_1.PathUtil.getRelativePathFromPrefixedPath(change.fullPath);
        switch (change.changeType) {
            case vsls.FileChangeType.Added:
                newName = changePath;
                break;
            case vsls.FileChangeType.Deleted:
                oldName = changePath;
                break;
            default:
                break;
        }
    });
    if (!oldName || !newName) {
        return null;
    }
    return { oldName: oldName, newName: newName };
}
class Client {
    constructor(parameters) {
        // Events
        this.coEditorsJoinedEventName = 'coEditorSwitchedFile';
        this.onPinEventName = 'onPin';
        this.onUnpinEventName = 'onUnpin';
        this.onUpdateCoEditorPositionEventName = 'onUpdateCoEditorPosition';
        this.coEditorsJoinedEvent = new events_1.EventEmitter();
        this.onPinEvent = new events_1.EventEmitter();
        this.onUnpinEvent = new events_1.EventEmitter();
        this.onUpdateCoEditorPositionEvent = new events_1.EventEmitter();
        // Lifecycle
        this.vscodeEventSubscriptions = [];
        this.isDisposed = false;
        this.sharedFileClients = {}; // Maps a lowercase file name to its file client
        this.pathManager = pathManager_1.PathManager.getPathManager();
        this.pendingRenames = [];
        this.highestReceivedEventId = -1;
        this.highestSendId = {}; // Maps a client ID to the highest message ID we have received from them
        this.messageProcessQueue = Promise.resolve();
        this.unprocessedMessages = {};
        this.isExpert = false;
        // Language service
        this.serverVersion = -1;
        this.highestLocalTextChange = -1;
        this.textChangeEventHistory = [];
        this.textChangeEventHistoryMaxSize = 1000;
        this.unacknowledgedTextChangeIds = {};
        // Co-editor tracking
        this.clientDecoratorManagers = {};
        this.positionTracker = new positionTracker_1.PositionTracker();
        this.currentVisibleEditors = {};
        // Action tracking
        this.joiningInitialFiles = {}; // Hashset of file names that need to be opened as part of the initial join
        this.pendingFileHandshakeCallbacks = {}; // Maps a file name to a callback that should be invoked when we receive a fileOpenAcknowledge for that file
        this.pendingFileSync = {}; // Maps a file name to its synchronized string content after the late join protocol has completed
        this.savingFiles = {}; // Hashset of file names that are being saved due to a remote save message. Needed to prevent re-sending a saveFile message when VS Code raises the documentSaved event.
        this.fileSaveRequestsPaused = false; // Flag to enable us to drop save requests when leaving a session
        // Telemetry
        this.jumpCount = 0;
        this.failedJumpCount = 0;
        this.pinCount = 0;
        this.unpinCount = 0;
        this.autoUnpinCount = 0;
        this.settingsCallbacks = {};
        this.initialPinIdToOwner = -1;
        this.updateNametagVisibilitySetting = () => {
            // Update nameTagVisibility value
            const nameTagSetting = config.get(config.Key.nameTagVisibility);
            const nameTagSettingValue = decorators_1.NameTagVisibility[nameTagSetting];
            this.nameTagVisibility = nameTagSettingValue || decorators_1.NameTagVisibility.Activity;
            // Update decorators
            Object.keys(this.clientDecoratorManagers).forEach((clientId) => {
                if (!this.clientDecoratorManagers[clientId]) {
                    return;
                }
                this.clientDecoratorManagers[clientId].nameTagVisibility = this.nameTagVisibility;
                this.clientDecoratorManagers[clientId].updateDecorators();
            });
        };
        this.updateDiagnosticLoggingSetting = () => {
            util_1.ExtensionUtil.setDiagnosticLogging(true);
        };
        this.updateShowReadOnlyUsersInEditorSetting = () => {
            if (config.get(config.Key.showReadOnlyUsersInEditor) === 'always') {
                // Show all read-only users
                for (let clientId of session_1.SessionContext.collaboratorManager.getCollaboratorSessionIds()) {
                    if (!this.clientDecoratorManagers[clientId] && this.clientAccessCheck().isClientReadOnly(clientId)) {
                        this.updateDecorators(clientId);
                    }
                }
            }
            else {
                // Hide all read-only unpinned users
                Object.keys(this.clientDecoratorManagers).forEach((clientId) => {
                    const manager = this.clientDecoratorManagers[clientId];
                    const clientIdNumber = parseInt(clientId, 10);
                    if (manager && clientIdNumber !== NaN && this.clientAccessCheck().isClientReadOnly(clientId) && !this.isPinned(clientIdNumber)) {
                        manager.dispose();
                        delete this.clientDecoratorManagers[clientId];
                    }
                });
            }
        };
        this.isExpert = parameters.isExpert;
        this.sourceEventService = parameters.sourceEventService;
        this.clientID = parameters.clientID;
        this.fileService = parameters.fileService;
        this.clientAccessCheck = parameters.clientAccessCheck;
        const nameTagSetting = config.get(config.Key.nameTagVisibility);
        const nameTagSettingValue = decorators_1.NameTagVisibility[nameTagSetting];
        this.nameTagVisibility = nameTagSettingValue || decorators_1.NameTagVisibility.Activity;
        this.coEditingTrace = traceSource_1.traceSource.withName(traceSource_1.TraceSources.ClientCoEditing);
        this.vsCodeEventTrace = traceSource_1.traceSource.withName(traceSource_1.TraceSources.ClientCoEditingVSCodeEvent);
        this.bufferManagerTrace = traceSource_1.traceSource.withName(traceSource_1.TraceSources.ClientCoEditingBufferManager);
        this.summonsSemaphore = new semaphore_async_await_1.default(1);
        this.coEditingTrace.info(`Name tag behavior: ${this.nameTagVisibility}`);
        // Create initial mapping of columns to editors for all open editors
        this.captureVisibleEditorInformation(vscode.window.visibleTextEditors);
        // Collect & process actual edits to a document to communicate those
        // changes to the other partcipents, and maintain our own state for
        // those joining later
        this.vscodeEventSubscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => this._onDidChangeTextDocument(e)));
        // Track the selection changes in a document (E.g. highlights, cursor
        // position) and communicate them to all clients so they can display
        // indicators to the other Participant positions in the documents
        this.vscodeEventSubscriptions.push(vscode.window.onDidChangeTextEditorSelection((e) => this._onDidChangeTextEditorSelection(e)));
        // Understand which documents are open, split (different columns),
        // closed, and other changes. (E.g editor configuration/layout changes)
        this.vscodeEventSubscriptions.push(vscode.window.onDidChangeVisibleTextEditors((e) => this._onDidChangeVisibleTextEditors(e)));
        // Handle the changes of the currently active editor -- this is important
        // because not all editors are really considered "editors". E.g the
        // terminal window isn't really an editor. In these cases we need to
        // update states. It's also important because that is where we're doing
        // the updates of people following us / breaking follow when you change
        // your active editor when following someone.
        this.vscodeEventSubscriptions.push(vscode.window.onDidChangeActiveTextEditor((e) => this._onDidChangeActiveTextEditor(e)));
        // When closing a document, we need to clean up state/buffers for our undo
        // management (document could be reopened, which would be new undo state)
        // as well as when a document is deleted, or renamed, where we need to
        // re-wriring of the state.
        this.vscodeEventSubscriptions.push(vscode.workspace.onDidCloseTextDocument((e) => this.onDidCloseTextDocument(e)));
        // Saves need to be propagated through the session, so other clients can
        // also save when indicated (guests aren't really saving, for example)
        this.vscodeEventSubscriptions.push(vscode.workspace.onDidSaveTextDocument((e) => this._onDidSaveTextDocument(e)));
        // Listens setting changes
        this.vscodeEventSubscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => this._onDidChangeConfiguration(e)));
        // Scrolling API is stable and available from vscode version 1.22.2, check if it exists to not break earlier versions of vscode.
        if (typeof vscode.window.onDidChangeTextEditorVisibleRanges === 'function') {
            // Tracks scrolling event on the text document.
            this.vscodeEventSubscriptions.push(vscode.window.onDidChangeTextEditorVisibleRanges((e) => this._onDidChangeTextEditorVisibleRanges(e)));
        }
        // Immediate react setting mapping
        this.settingsCallbacks['liveshare.nameTagVisibility'] = this.updateNametagVisibilitySetting;
        this.settingsCallbacks['liveshare.diagnosticLogging'] = this.updateDiagnosticLoggingSetting;
        this.settingsCallbacks['liveshare.showReadOnlyUsersInEditor'] = this.updateShowReadOnlyUsersInEditorSetting;
    }
    get isOwner() {
        return !this.isExpert;
    }
    get isReadOnlyGuest() {
        return this.isExpert && this.clientAccessCheck().isReadOnly;
    }
    init() {
        // Now start listening for co-editing events that convey all the changes
        // from other clients, that are related to co-editing.
        this.sourceEventService.onEvent((eventData) => {
            this.messageProcessQueue = this.messageProcessQueue
                .then(() => this._onMessage(eventData));
        }, null, this.vscodeEventSubscriptions);
        this.fileService.onFilesChanged((e) => this.fileServiceFilesChanged(e));
        if (this.isExpert) {
            this.joiningInitialFiles = {};
            const jrMessage = coauthoringService_1.MessageFactory.JoinRequestMessage(this.clientID);
            this.postMessage(jrMessage);
        }
        this.shareActiveDocumentIfNotTheExpert();
        this.updatePinIconFromActiveEditor();
        this._listenForUserInitiatedUndoRedo();
    }
    resetLanguageServicesDataStructures() {
        this.textChangeEventHistory = [];
        this.unacknowledgedTextChangeIds = {};
    }
    get currentServerVersion() {
        return this.serverVersion;
    }
    get currentHighestLocalTextChange() {
        return this.highestLocalTextChange;
    }
    get textChangeHistory() {
        return this.textChangeEventHistory;
    }
    get hasUnacknowledgedTextChanges() {
        this.removeOldUnacknowledgedTextChanges();
        return (Object.keys(this.unacknowledgedTextChangeIds).length !== 0);
    }
    removeOldUnacknowledgedTextChanges() {
        const now = (new Date()).getTime();
        for (const sendId in this.unacknowledgedTextChangeIds) {
            if ((now - this.unacknowledgedTextChangeIds[sendId]) > 5000) {
                delete this.unacknowledgedTextChangeIds[sendId];
                telemetry_1.Instance.sendFault(coauthoringTelemetry_1.Event.DROPPED_HOST_MESSAGE_FAULT, telemetry_1.FaultType.NonBlockingFault, 'Did not receive acknowledgement of host message');
            }
        }
    }
    postMessage(message) {
        if (this.isDisposed) {
            return;
        }
        message.sendId = Client.sendId++;
        if (message.messageType === vsls.MessageType.TextChange) {
            this.highestLocalTextChange = message.sendId;
            this.unacknowledgedTextChangeIds[message.sendId] = (new Date()).getTime();
        }
        this.sourceEventService.fireEventAsync(coauthoringService_1.CoauthoringService.SERVICE, JSON.stringify(message));
    }
    dispose() {
        this.isDisposed = true;
        if (this.clientDecoratorManagers) {
            Object.keys(this.clientDecoratorManagers).forEach((cId) => {
                this.clientDecoratorManagers[cId].dispose();
            });
        }
        this.coEditorsJoinedEvent.removeAllListeners();
        this.vscodeEventSubscriptions.forEach((d) => {
            d.dispose();
        });
        this.positionTracker.dispose();
        this.updatePinableCommandStatus(false);
        this.setPinned(false);
        // Close summon states
        this.summoningParticipants = null;
        // Send telemetry
        coauthoringTelemetry_1.CoauthoringTelemetry.SessionClosed(this.jumpCount, this.failedJumpCount, this.pinCount, this.unpinCount, this.autoUnpinCount);
        Object.keys(this.sharedFileClients).forEach((fileName) => {
            this.sharedFileClients[fileName].dispose();
        });
        this.onPinEvent.removeAllListeners();
        this.onUnpinEvent.removeAllListeners();
        this.onUpdateCoEditorPositionEvent.removeAllListeners();
    }
    _listenForUserInitiatedUndoRedo() {
        if (!config.featureFlags.localUndo) {
            return;
        }
        this.vscodeEventSubscriptions.push(util_1.ExtensionUtil.registerCommand('undo', this.performUserInitiatedUndo, this));
        this.vscodeEventSubscriptions.push(util_1.ExtensionUtil.registerCommand('redo', this.performUserInitiatedRedo, this));
    }
    _onDidChangeTextDocument(e) {
        const fileName = this.pathManager.localPathToRelativePath(e.document.uri);
        if (fileName === null) {
            // This is likely a document we're not tracking or can't
            // handle, so don't try to handle this event.
            return;
        }
        // Get the client for this file -- this is where we hand off the actual
        // document changes to be handled on a per-file basis, and broadcast to
        const fileClient = this.getSharedFileClient(fileName);
        if (!fileClient) {
            this.coEditingTrace.warning(`Edited a shared document that did not have a file client opened (${formatPath(fileName)})`);
            return;
        }
        this.vsCodeEventTrace.verbose(`onDidChangeTextDocument: (${formatPath(fileName)})`);
        // There are some odd corner cases where edits to the document haven't
        // marked it as dirty, despite the edits being set on the document (which
        // would otherwise imply dirty document).
        // The primary case of this is when the document is saved _externally_
        // to the IDE. When the document that was saved has no edits, VSCode
        // reloads the document, and doesn't raise a save event, only the edit.
        // We can detect that by saying "Oh, hey, you had edits, and you were
        // dirty before AND after? We know what to do!".
        let changeDidntMakeDocumentDirty = false;
        if (this.isOwner) {
            changeDidntMakeDocumentDirty = fileClient.updateDirtyState(e.document.isDirty);
        }
        if (e.contentChanges.length === 0) {
            // VSCode indicates that the dirty state changed by sending
            // this no-changes event. Since we don't care about the
            // dirty state via this notification, drop them on the floor.
            this.vsCodeEventTrace.verbose('onDidChangeTextDocument: Document dirty state changes');
            return;
        }
        fileClient.onDidChangeTextDocument(e);
        this.positionTracker.onDidChangeTextDocument(fileName, e);
        // If we have a pending set of edits, and we think we're about to make the
        // document 'clean', lets just wait and see. VSCode is sending edits
        // without marking the editor as dirty.
        if (!fileClient.waitingForRemoteEditsToBeApplied() && changeDidntMakeDocumentDirty) {
            this.postSaveMessageToOtherParticipants(fileClient.fileName);
        }
        // If this change appears to have been made by the local user, unpin the viewcolumn in which the edit was made
        // Unless we're enabling strong follow behaviour, where edits don't break following
        if (fileClient.waitingForRemoteEditsToBeApplied() || config.featureFlags.strongFollowBehavior) {
            // This was caused by a remote edit; don't unpin anything
            return;
        }
        const activeEditor = this.activeEditor;
        const changeIsInActiveEditor = activeEditor.document.uri.toString() === e.document.uri.toString();
        if (changeIsInActiveEditor) {
            this.unpinByEditor(activeEditor);
        }
    }
    _onDidChangeTextEditorVisibleRanges(e) {
        if (!e.textEditor || !e.textEditor.document) {
            return;
        }
        const fileName = this.pathManager.localPathToRelativePath(e.textEditor.document.uri);
        if (!fileName) {
            return;
        }
        this.vsCodeEventTrace.verbose(`onDidChangeTextEditorVisibleRanges (${formatPath(fileName)}): ${JSON.stringify(e.visibleRanges)}`);
        this.sendLayoutChangeMessage(fileName, e.visibleRanges);
    }
    _onDidChangeTextEditorSelection(e) {
        if (this.justChangedDocumentTimeout) {
            clearTimeout(this.justChangedDocumentTimeout);
            this.justChangedDocumentTimeout = null;
        }
        if (!e.textEditor || !e.textEditor.document) {
            return;
        }
        const document = e.textEditor.document;
        const fileName = this.pathManager.localPathToRelativePath(document.uri);
        if (fileName) {
            this.vsCodeEventTrace.verbose(`onDidChangeTextEditorSelection (${formatPath(fileName)}): ${JSON.stringify(e.selections)}`);
        }
        this.sendSelectionChangeMessage(document, e.selections);
    }
    _onDidChangeActiveTextEditor(e) {
        // Always update our pin status
        this.updatePinIconFromActiveEditor();
        if (!e || !e.document) {
            // Implies when we have no active text editor, so theres nothing
            // for us to do
            this.updatePinableCommandStatus(false);
            return;
        }
        const document = e.document;
        const fileName = this.pathManager.localPathToRelativePath(document.uri);
        if (fileName === null) {
            // Not a document we care about
            return;
        }
        this.vsCodeEventTrace.info(`onDidChangeActiveTextEditor (${formatPath(fileName)})`);
        // If we have an owner ID, we should automatically pin to that owner for
        // a better start experience. We need to reset it so that the next editor
        // change doesn't for the next editor change
        if (this.initialPinIdToOwner !== -1) {
            this.pin(e, this.initialPinIdToOwner);
            this.initialPinIdToOwner = -1;
        }
        // Make sure that we've notified others that a new document has been
        // opened. It's expected that this does the right thing depending on
        // our state, so we don't need to handle it here.
        this.shareActiveDocumentIfNotTheExpert();
        // When opening a document for the first time, VS Code does not fire a onDidChangeTextEditorSelection event.
        // This means that collaborators will still see this user in the previous document. As workaround, force send a
        // selection change message after a brief period if VS Code did not raise the event itself.
        this.justChangedDocumentTimeout = setTimeout(() => this.sendCurrentSelectionMessage(), initialSelectionNotificationDelay);
        // Update decorators so they show in this new editor.
        Object.keys(this.clientDecoratorManagers).forEach((clientId) => {
            this.clientDecoratorManagers[clientId].updateDecorators();
        });
    }
    /**
     * When the visible editors change in VS Code, it really means 'the primary
     * editor or editors, across all columns have changed'. This means for two
     * editors open in one column, and you switch between them, your visible
     * editors have changed. We can take advantage of this, and the slight hack
     * of leveraging the private 'id' field in the editor to have a clean way of
     * handling pinned documents across columns.
     *
     * This is because when we do pinning, we look for flag saying 'we're
     * tracking this client', and look for it on all editors. Now, if an editor
     * is closed, it's implicitly removed from the list, and thus we'll no longer
     * believe we're following it.
     */
    _onDidChangeVisibleTextEditors(visibleEditors) {
        this.vsCodeEventTrace.verbose(`onDidChangeVisibleTextEditors (new active viewcolumns: ${visibleEditors.map((editor) => editor.viewColumn).join(', ')})`);
        // VS Code quirk: Sometimes, "invisible", non-document editors with an undefined viewcolumn get inserted into
        // the event. Filter them out.
        visibleEditors = visibleEditors.filter((editor) => {
            return typeof editor.viewColumn !== 'undefined';
        });
        // When performing the document open, we see two visibleTextEditorsChanged
        // events -- one claiming 0 editors, and then a second (before the
        // deferrered handling happens) with 1 editor. Since this can happen at
        // any time, rather than unintentionally handling the 0 editor case, and
        // and clearing follow, lets cancel any _unhandled_ visible editor changes
        // and requeue. Since we have a 1ms delay, this should be very infrequent
        // except in the case described above.
        if (this.activeEditorsChangedTimeout) {
            clearTimeout(this.activeEditorsChangedTimeout);
            this.activeEditorsChangedTimeout = null;
        }
        // VS Code quirk: when this event is raised, the editors don't yet know about their new viewcolumn, so it's
        // impossible to track exactly which editor is now in which column. To work around this, handle the event
        // asynchronously, which gives VS Code the time to update the viewcolumn properties of the visible editors.
        this.activeEditorsChangedTimeout = setTimeout(() => {
            this.activeEditorsChangedTimeout = null;
            this.captureVisibleEditorInformation(visibleEditors);
        }, 1);
    }
    _addPinnedInfoForEditor(editor, editors, pinToClientId = -1) {
        const id = getEditorId(editor);
        const previousData = this.currentVisibleEditors[id];
        let pinnedClient = (previousData) ? previousData.pinnedClient : -1;
        // If we were supplied a client that we're explicitly pinning this editor to
        // then override whatever else we've found with that client.
        if (pinToClientId > -1) {
            pinnedClient = pinToClientId;
        }
        const newEditorInfo = {
            pinnedClient: pinnedClient,
            column: editor.viewColumn,
            id: id,
            isChangingDocument: false,
        };
        editors[getEditorId(editor)] = newEditorInfo;
    }
    getEditorInfoForClient(clientId) {
        let matchingEditorInfo = null;
        Object.keys(this.currentVisibleEditors).some((key) => {
            const editorInfo = this.currentVisibleEditors[key];
            if (editorInfo.pinnedClient !== clientId) {
                return false;
            }
            matchingEditorInfo = editorInfo;
            return true;
        });
        return matchingEditorInfo;
    }
    getColumnForPinnedClient(clientId) {
        const editorInfo = this.getEditorInfoForClient(clientId);
        if (editorInfo == null) {
            return vscode.ViewColumn.Active;
        }
        return editorInfo.column;
    }
    getClientIdIfEditorIsPinned(editor) {
        if (!editor) {
            return -1;
        }
        const editorId = getEditorId(editor);
        const columnInformation = this.currentVisibleEditors[editorId];
        if (!columnInformation) {
            return -1;
        }
        return columnInformation.pinnedClient;
    }
    captureVisibleEditorInformation(editors) {
        // Calculate new editors information -- this can just be the list of currently
        // visible documents
        let newVisibleEditors = {};
        editors.forEach((editor) => this._addPinnedInfoForEditor(editor, newVisibleEditors));
        this.currentVisibleEditors = newVisibleEditors;
        this.updatePinIconFromActiveEditor();
    }
    onDidCloseTextDocument(e) {
        let filename = this.pathManager.localPathToRelativePath(e.uri);
        let sharedClient = this.getSharedFileClient(filename);
        if (!sharedClient) {
            // We don't know about this file, so we're not going to do anything
            return;
        }
        // The document definitely closed, so the undo state is lost. So always
        // clear it, even if it were a rename.
        sharedClient.clearUndoStateDueToDocumentClosing();
        let newName = this.getNewNameFromRename(sharedClient.fileName);
        // First check to see if it's in the rename list, and what it's new name is
        if (newName) {
            this.renameSharedFileClient(sharedClient, newName);
            return;
        }
        // For non owners, we've already handled the delete in the file service
        // handler. Additionally, if the file still exists here, we don't want
        // to clean it up, since it could come back.
        if (!this.isOwner || fs.existsSync(e.fileName)) {
            return;
        }
        this.removeSharedFileClient(sharedClient);
    }
    getNewNameFromRename(filename) {
        const rename = this.pendingRenames.filter((renameInformation) => renameInformation.oldName === filename)[0];
        if (!rename) {
            return null;
        }
        // Now we've got a rename, we need to remove it from the list
        const pendingItemIndex = this.pendingRenames.indexOf(rename);
        this.pendingRenames.splice(pendingItemIndex, 1);
        return rename.newName;
    }
    _onDidSaveTextDocument(e) {
        if (!e) {
            return;
        }
        const fileName = this.pathManager.localPathToRelativePath(e.uri);
        if (!fileName) {
            return;
        }
        if (this.fileSaveRequestsPaused) {
            return;
        }
        this.vsCodeEventTrace.info(`onDidSaveTextDocument (${formatPath(fileName)})`);
        if (this.isOwner) {
            const sharedFile = this.getSharedFileClient(fileName);
            sharedFile.takeSnapshot();
            sharedFile.updateDirtyState(e.isDirty);
        }
        const lowercaseFileName = fileName.toLowerCase();
        if (this.savingFiles[lowercaseFileName]) {
            // This save was initiated by a saveFile message
            delete this.savingFiles[lowercaseFileName];
            return;
        }
        // This save appears to have been initiated by the user; send a saveFile message to collaborators
        this.postSaveMessageToOtherParticipants(fileName);
    }
    postSaveMessageToOtherParticipants(fileName) {
        const saveFileMsg = coauthoringService_1.MessageFactory.SaveFileMessage(this.clientID, fileName);
        this.postMessage(saveFileMsg);
    }
    _onDidChangeConfiguration(e) {
        telemetry_1.Instance.reportChangedSetting();
        Object.keys(this.settingsCallbacks).forEach((settingId) => {
            if (e.affectsConfiguration(settingId)) {
                this.settingsCallbacks[settingId]();
            }
        });
    }
    pauseProcessingFileSaveRequests() {
        this.fileSaveRequestsPaused = true;
    }
    resumeProcessingFileSaveRequests() {
        this.fileSaveRequestsPaused = false;
    }
    fileServiceFilesChanged(e) {
        // Assumption: Renames come in changes of Add + Delete Only
        // Assumption: If we see a delete on it's own, or in a bucket of changes
        //             larger than 2, it's just a delete.
        // Fast path changes that are one item, and "update", seen on file saves
        if (e.changes.length === 1 && e.changes[0].changeType === vsls.FileChangeType.Updated) {
            return;
        }
        let renameDetails = getFileNamesFromRenameFileChange(e.changes);
        if (renameDetails) {
            // If we got extracted changes, we assume it was actually a rename
            // and add the details to the pending rename list
            this.pendingRenames.push(renameDetails);
            return;
        }
        // Find the deletes, and remove any shared clients. Documents that are
        // open will be cleaned up shortly (by VS Code), so we don't need to close
        // them ourselves.
        e.changes.forEach((change) => {
            if (change.changeType !== vsls.FileChangeType.Deleted) {
                return;
            }
            const changePath = util_1.PathUtil.getRelativePathFromPrefixedPath(change.fullPath);
            let sharedClient = this.getSharedFileClient(changePath);
            if (!sharedClient) {
                return;
            }
            this.removeSharedFileClient(sharedClient);
        });
    }
    async _onMessage(msg) {
        if (this.isDisposed) {
            // This can happen if the user left the session before the client was done processing all queued messages.
            return;
        }
        if (msg.sourceId !== coauthoringService_1.CoauthoringService.SERVICE) {
            // Drop any messages that aren't destined for us
            return;
        }
        if (msg.eventId <= this.highestReceivedEventId) {
            this.coEditingTrace.error(`Message out of order: received ${msg.eventId}, highest received is ${this.highestReceivedEventId}`);
        }
        else {
            this.highestReceivedEventId = msg.eventId;
        }
        // JSON parsing does not add default property values, so run the deserialized message through the factory.
        let message = JSON.parse(msg.jsonContent);
        message = coauthoringService_1.MessageFactory.CoauthoringMessage(message);
        try {
            const senderId = message.clientId;
            // This block is here to update the data structures needed by language services to determine whether or not
            // requests from guests can be serviced by the host (i.e. if the two buffers agree)
            if (message.messageType === vsls.MessageType.TextChange) {
                let textChangeMessage = message;
                if (textChangeMessage.clientId === this.clientID) {
                    delete this.unacknowledgedTextChangeIds[textChangeMessage.sendId];
                }
                this.serverVersion = textChangeMessage.changeServerVersion;
                if (this.textChangeEventHistory.length >= this.textChangeEventHistoryMaxSize) {
                    this.textChangeEventHistory.shift();
                }
                this.textChangeEventHistory.push(textChangeMessage);
            }
            // Don't handle our own messages unless the message type requires it.
            if (senderId === this.clientID && message.messageType !== vsls.MessageType.TextChange) {
                return;
            }
            // Update the highwater marks to track where each client is relative to
            // the messages we've already seen from them.
            if (typeof message.sendId === 'number' && message.sendId > 0) {
                if (typeof this.highestSendId[senderId] !== 'number') {
                    this.highestSendId[senderId] = -1;
                }
                if (message.sendId <= this.highestSendId[senderId]) {
                    this.coEditingTrace.error(`Message from client #${senderId} out of order: received ${message.sendId}, highest received is ${this.highestSendId[senderId]}`);
                }
                else {
                    this.highestSendId[senderId] = message.sendId;
                }
            }
            let messageFileName = message.fileName;
            let targetFileClient = this.getSharedFileClient(messageFileName);
            // Certain types of file message require custom handling when we don't
            // have a file client for that file -- specifically, handling changes
            // and notifications we havn't really processed yet. Note, however, that
            // the FileOpen* messages don't get handled here at all.
            if (coauthoringService_1.IsFileContentMessage(message) && !targetFileClient) {
                switch (message.messageType) {
                    case vsls.MessageType.SelectionChange:
                        // Even if there are no file clients for this file yet, we need to remember this collaborator's
                        // position. This also causes the document to be opened invisibly, triggering the document
                        // handshake.
                        this.coEditingTrace.info(`Processing a selection change for a file client that does not exist yet (${formatPath(messageFileName)})`);
                        this.updateCoEditorPosition(message);
                        break;
                    default:
                        // Queue this message until the file client has been created (a file open acknowledge is most
                        // likely on the way)
                        this.coEditingTrace.info(`The file client does not exist yet; queuing file message for ${formatPath(messageFileName)}: ${message.messageType}`);
                        if (!this.unprocessedMessages[messageFileName]) {
                            this.unprocessedMessages[messageFileName] = [];
                        }
                        this.unprocessedMessages[messageFileName].push(new vscodeBufferManager_1.MessageAndVersionNumber(message, msg.eventId));
                        break;
                }
                // We can't process any more of these messages since theres no
                // file client to push these changes into.
                return;
            }
            switch (message.messageType) {
                case vsls.MessageType.TextChange:
                case vsls.MessageType.SelectionChange:
                    targetFileClient.onIncomingMessage(message, msg.eventId);
                    break;
                case vsls.MessageType.LayoutScroll:
                    if (session_1.SessionContext.EnableVerticalScrolling) {
                        this.updateCoEditorScrollPosition(message);
                    }
                    break;
                case vsls.MessageType.JoinRequest:
                    this.fireCoEditorsJoined([senderId]);
                    if (!this.isOwner) {
                        break;
                    }
                    const coEditors = session_1.SessionContext.collaboratorManager.getCollaboratorSessionIds();
                    coEditors.unshift(this.clientID); // Make sure the sharer is the 1st in the list
                    // Send the list of shared documents, with the active document being first
                    const activeFileName = this.activeFileName;
                    const sharedFileNames = [];
                    Object.keys(this.sharedFileClients).forEach((lowercaseSharedFileName) => {
                        const actualFileName = this.sharedFileClients[lowercaseSharedFileName].fileName;
                        if (actualFileName === activeFileName) {
                            sharedFileNames.unshift(actualFileName);
                        }
                        else {
                            sharedFileNames.push(actualFileName);
                        }
                    });
                    this.postMessage(coauthoringService_1.MessageFactory.JoinAcknowledgeMessage(this.clientID, senderId, coEditors, sharedFileNames));
                    break;
                case vsls.MessageType.JoinAcknowledge:
                    const joinAcknowledgeMsg = message;
                    if (joinAcknowledgeMsg.joinerId === this.clientID) {
                        // Set the owner id, to be used for pinning after opening active document.
                        this.initialPinIdToOwner = joinAcknowledgeMsg.clientId;
                        this.fireCoEditorsJoined(joinAcknowledgeMsg.clientIds);
                        joinAcknowledgeMsg.files.forEach((openFileName) => {
                            const lowercaseOpenFileName = openFileName.toLowerCase();
                            this.joiningInitialFiles[lowercaseOpenFileName] = true;
                            this.requestOpenSharedFile(openFileName); // Do not await this; fire asynchronously so we can process the subsequent handshake messages
                        });
                    }
                    else if (this.isExpert) {
                        // Send current selection for the new joiner
                        this.sendCurrentSelectionMessage();
                    }
                    break;
                case vsls.MessageType.SaveFile:
                    // Check if collaboration is joined as read-only, and ignore the message
                    if (this.isReadOnlyGuest) {
                        break;
                    }
                    const fileSaveMsg = message;
                    const lowercaseSaveFileName = fileSaveMsg.fileName.toLowerCase();
                    this.savingFiles[lowercaseSaveFileName] = true;
                    const targetUri = this.pathManager.relativePathToLocalPath(fileSaveMsg.fileName);
                    try {
                        const targetDocument = await vscode.workspace.openTextDocument(targetUri);
                        await targetDocument.save();
                    }
                    catch (_a) {
                        // No need to handle an error if it failed to save.
                    }
                    break;
                case vsls.MessageType.FileOpenAcknowledge:
                    const fileOpenAcknowledgeMsg = message;
                    if (fileOpenAcknowledgeMsg.joinerId === this.clientID) {
                        const lowercaseOpenFileName = fileOpenAcknowledgeMsg.fileName.toLowerCase();
                        if (this.pendingFileHandshakeCallbacks[lowercaseOpenFileName]) {
                            this.pendingFileHandshakeCallbacks[lowercaseOpenFileName](fileOpenAcknowledgeMsg);
                        }
                        else {
                            // Got a response for a file we never requested...
                            this.coEditingTrace.warning(`Received unrequested fileOpenAcknowledge message for ${formatPath(fileOpenAcknowledgeMsg.fileName)}`);
                        }
                    }
                    else if (this.isExpert && fileOpenAcknowledgeMsg.fileName === this.activeFileName) {
                        // Someone is opening the file we are in. Send our current selection.
                        this.sendCurrentSelectionMessage();
                    }
                    break;
                case vsls.MessageType.FileOpenRequest:
                    const fileOpenRequestMsg = message;
                    const fileName = fileOpenRequestMsg.fileName;
                    if (this.isExpert) {
                        if (!this.getSharedFileClient(fileName)) {
                            // Someone is opening a file that isn't shared yet. Open it too.
                            this.requestOpenSharedFile(fileName); // Do not await this; fire asynchronously so we can process the subsequent handshake messages
                        }
                        break;
                    }
                    // When we don't find the document, we can't just create the file
                    // client -- we have to open the document first, since there is
                    // currently no "invisible" editor support in VS Code.
                    let fileClient = this.getSharedFileClient(fileName);
                    if (!fileClient) {
                        let document;
                        try {
                            document = await vscode.workspace.openTextDocument(this.pathManager.relativePathToLocalPath(fileName));
                        }
                        catch (_b) {
                            const failedResponse = coauthoringService_1.MessageFactory.FileOpenAcknowledgeMessage(this.clientID, fileName, senderId, 0, 0, [], 'Unable to open this file -- only text documents are supported', [], true, true);
                            this.postMessage(failedResponse);
                            break;
                        }
                        fileClient = this.createSharedFileClient(fileName, document.getText(), document.isDirty, document.languageId);
                    }
                    let snapshot = fileClient.getSavedSnapshotOrFallback(fileOpenRequestMsg.hashCode);
                    const bufferHistory = fileClient.getCurrentHistory();
                    const initialVersion = bufferHistory.shift(); // For the 1st history version, only the version number is needed, not the associated message.
                    const response = coauthoringService_1.MessageFactory.FileOpenAcknowledgeMessage(this.clientID, fileName, senderId, snapshot.serverVersionNumber, initialVersion.serverVersionNumber, snapshot.changes, snapshot.fallbackText, bufferHistory, /*isReadOnly*/ false, /*wasUnableToOpen*/ false);
                    this.postMessage(response);
                    // If we've been asked to send the jump to when opened, and the
                    // user is actively looking at the document, send a selection
                    // message with the sender to force a follow on the otherside
                    if (fileOpenRequestMsg.sendJumpTo && fileOpenRequestMsg.fileName === this.activeFileName) {
                        this.sendCurrentSelectionMessage(senderId);
                    }
                    break;
                case vsls.MessageType.Summon:
                    if (!this.summoningParticipants) {
                        this.summoningParticipants = new Set();
                    }
                    if (session_1.SessionContext.SupportSummonParticipants && !this.summoningParticipants.has(message.clientId)) {
                        this.summoningParticipants.add(message.clientId);
                        const summonsMsg = message;
                        this.RespondToSummonsAsync(summonsMsg.clientId);
                    }
                    break;
                default:
                    // Other messages not implemented yet.
                    this.coEditingTrace.warning(`Received unknown message type: ${message.messageType}`);
            }
        }
        catch (e) {
            const errorMsg = `Rejected promise while processing a coauthoring message of type ${message.messageType}`;
            this.coEditingTrace.error(`${errorMsg}:\n${e.message}`);
            coauthoringTelemetry_1.CoauthoringTelemetry.ReportCoeditingError(errorMsg, e);
        }
    }
    async RespondToSummonsAsync(clientId) {
        await this.summonsSemaphore.acquire();
        const focusMessage = `${session_1.SessionContext.collaboratorManager.getDisplayName(clientId)} requested you to follow them.`;
        if (config.get(config.Key.focusBehavior) === 'accept') {
            vscode.window.showInformationMessage(focusMessage);
            this.pin(this.activeEditor, clientId);
        }
        else {
            const acceptAction = 'Follow';
            const rejectAction = 'Ignore';
            let result = await vscode.window.showInformationMessage(focusMessage, acceptAction, rejectAction);
            if (result === acceptAction) {
                this.pin(this.activeEditor, clientId);
            }
        }
        this.summoningParticipants.delete(clientId);
        this.summonsSemaphore.release();
    }
    getSharedFileClientFromEditor(editor) {
        if (!editor || !editor.document) {
            // Not a real editor, or document, so no file client
            return null;
        }
        const fileName = this.pathManager.localPathToRelativePath(editor.document.uri);
        return this.getSharedFileClient(fileName);
    }
    getSharedFileClient(fileName) {
        if (typeof fileName !== 'string') {
            return null;
        }
        const lowerCaseFileName = fileName.toLowerCase();
        return this.sharedFileClients[lowerCaseFileName] || null;
    }
    createSharedFileClient(fileName, initialContent, dirty, languageId) {
        const existingClient = this.getSharedFileClient(fileName);
        if (existingClient) {
            this.coEditingTrace.warning(`Attempted to re-create an existing file client for ${formatPath(fileName)}`);
            return existingClient;
        }
        this.coEditingTrace.info(`Creating file client for ${formatPath(fileName)}`);
        const uri = this.pathManager.relativePathToLocalPath(fileName);
        const lowerCaseFileName = fileName.toLowerCase();
        const newFileClient = new ClientFileData(this, fileName, uri, initialContent, this.bufferManagerTrace, dirty);
        this.sharedFileClients[lowerCaseFileName] = newFileClient;
        if (languageId) {
            newFileClient.setLanguageId(languageId);
        }
        // Newly created, so we need an initial snapshot to work from
        newFileClient.takeSnapshot();
        return newFileClient;
    }
    renameSharedFileClient(client, newName) {
        const oldNameLowerCase = client.fileName.toLowerCase();
        // Remove it from the old file name, so we don't continue to manipulate
        // or handle messages for that old filename
        delete this.sharedFileClients[oldNameLowerCase];
        // Update it's new file name on the client itself, and add it back into
        // to the map at it's new file name so that any edits will correctly apply
        // to the same document, depsite it getting a new name.
        client.updateFileName(newName);
        this.sharedFileClients[newName.toLowerCase()] = client;
    }
    removeSharedFileClient(client) {
        delete this.sharedFileClients[client.fileName.toLowerCase()];
        client.dispose();
    }
    shareActiveDocumentIfNotTheExpert() {
        if (this.isExpert) {
            return;
        }
        const activeFileName = this.activeFileName;
        if (!activeFileName || this.getSharedFileClient(activeFileName)) {
            return;
        }
        const document = this.activeEditor.document;
        this.createSharedFileClient(activeFileName, document.getText(), document.isDirty, document.languageId);
        this.postMessage(coauthoringService_1.MessageFactory.FileOpenRequestMessage(this.clientID, activeFileName, 0, false));
    }
    /**
     * Opens the specified file as a VS Code document, which ends up going through the file system provider. The file
     * system provider will then call back into the client to perform the handshake protocol with the sharer ("late
     * join") for this file.
     *
     * @param fileName the name of the file to open
     */
    async requestOpenSharedFile(fileName) {
        if (this.isOwner) {
            return;
        }
        const uri = this.pathManager.relativePathToLocalPath(fileName);
        let document;
        try {
            document = await vscode.workspace.openTextDocument(uri);
        }
        catch (_a) {
            return;
        }
        // TODO: When we support edits on buffers without requiring the tab to be open, process the pending messages on
        // the invisible buffer before fully opening the document.
        const sharedFileClient = this.getSharedFileClient(fileName);
        sharedFileClient.setLanguageId(document.languageId);
        sharedFileClient.drainMessageQueue();
    }
    /**
     * Sends a fileOpenRequest for the specified file, and performs synchronization of the file content after receiving
     * the acknowledge from the sharer.
     *
     * @param fileName the name of the file
     * @param receivedContent the initial content that the file service received for this file
     */
    async performFileOpenHandshake(fileName, receivedContent) {
        if (this.isOwner) {
            return;
        }
        const lowercaseFileName = fileName.toLowerCase();
        if (this.pendingFileSync[lowercaseFileName]) {
            return this.pendingFileSync[lowercaseFileName];
        }
        const existingFileClient = this.getSharedFileClient(fileName);
        if (existingFileClient) {
            return existingFileClient.getBufferContent();
        }
        return this.pendingFileSync[lowercaseFileName] = new Promise(async (resolve, reject) => {
            const fileOpenAcknowledgeMsg = await new Promise((ackResolve, ackReject) => {
                this.pendingFileHandshakeCallbacks[lowercaseFileName] = ackResolve;
                const currentHash = util_1.calculateFileHash(receivedContent);
                const isInitialFile = !!this.joiningInitialFiles[lowercaseFileName];
                delete this.joiningInitialFiles[lowercaseFileName];
                const fileOpenRequestMsg = coauthoringService_1.MessageFactory.FileOpenRequestMessage(this.clientID, fileName, currentHash, /* sendJumpTo */ isInitialFile || this.initialPinIdToOwner !== -1);
                this.postMessage(fileOpenRequestMsg);
            });
            delete this.pendingFileHandshakeCallbacks[lowercaseFileName];
            // We were unable to resolve this file (for some reason), indicate
            // that we failed to open it it, rather than returning content.
            if (fileOpenAcknowledgeMsg.wasUnableToOpen) {
                resolve(false);
            }
            const initialSyncContent = fileOpenAcknowledgeMsg.fallbackText ? fileOpenAcknowledgeMsg.fallbackText : receivedContent;
            const tempBuffer = new collabBuffer_1.CollabBuffer(initialSyncContent);
            // Undo unacknowledged changes that are included in the content received by the file service
            fileOpenAcknowledgeMsg.changes.forEach((edits) => {
                tempBuffer.applyRemoteEdits(edits.map((edit) => {
                    return {
                        position: edit.start,
                        length: edit.length,
                        text: edit.newText
                    };
                }));
            });
            // Create the file client with the resulting text and apply the initial history
            const newFileClient = this.createSharedFileClient(fileName, tempBuffer.getContent(), false);
            newFileClient.initializeHistory(fileOpenAcknowledgeMsg);
            // Flush messages that were being held because the file client wasn't ready
            if (this.unprocessedMessages[fileName]) {
                this.unprocessedMessages[fileName].forEach((coauthoringMsg) => {
                    newFileClient.onIncomingMessage(coauthoringMsg.message, coauthoringMsg.serverVersionNumber, vscodeBufferManager_1.CoeditingIncomingMessageBehavior.Queue);
                    newFileClient.updateInitialHistoryHighWatermark(coauthoringMsg.serverVersionNumber);
                });
                delete this.unprocessedMessages[fileName];
            }
            resolve(newFileClient.getBufferContent());
            delete this.pendingFileSync[lowercaseFileName];
        });
    }
    uriToFileName(uri) {
        return this.pathManager.localPathToRelativePath(uri);
    }
    async updateCoEditorPosition(message) {
        const clientId = message.clientId;
        if (clientId === this.clientID) {
            return;
        }
        const documentUri = this.pathManager.relativePathToLocalPath(message.fileName);
        const document = await vscode.workspace.openTextDocument(documentUri);
        // Convert the selection to VS Code coordinates and update the position tracker
        const fileClient = this.getSharedFileClient(message.fileName);
        const selectionStart = fileClient.toVSCodeDocumentPos(message.start, document);
        const selectionEnd = fileClient.toVSCodeDocumentPos(message.start + message.length, document);
        const vsCodeSelectionRange = new vscode.Range(selectionStart, selectionEnd);
        this.positionTracker.setClientPosition(message.clientId, message.fileName, document, vsCodeSelectionRange, message.isReversed);
        if (!await this.clientAccessCheck().isClientReadOnly(message.clientId) ||
            this.isPinned(message.clientId) ||
            config.get(config.Key.showReadOnlyUsersInEditor) === 'always') {
            // Update the co-editor's position indicators
            this.updateDecorators(clientId);
            // Honor force jump to
            if (message.forceJumpForClientId === this.clientID) {
                // Make sure we restore debugging state _before_ jumping
                // to the host.
                // Scenario:
                // 1. Host is debugging, and they're broken into the debugger
                // 2. Their active document is _not_ the one where the
                //    program is stopped.
                // 3. Guest jumps to the active document (correct), but then
                //    the debugger state is restored, and they jump to that file
                //    & line.
                //
                // By waiting till after debug session is joined (or, it was
                // decided not to), we restore the correct document position.
                session_1.SessionContext.waitForDebugJoining().then(() => {
                    this.jumpTo(clientId);
                });
            }
            // Jump to this participant in the appropriate viewcolumn if we are pinned
            const pinnedColumnForClient = this.getColumnForPinnedClient(clientId);
            if (pinnedColumnForClient !== vscode.ViewColumn.Active) {
                this.jumpTo(clientId, pinnedColumnForClient);
            }
        }
        this.onUpdateCoEditorPositionEvent.emit(this.onUpdateCoEditorPositionEventName);
    }
    updateDecorators(clientId) {
        if (!this.clientDecoratorManagers[clientId]) {
            const name = session_1.SessionContext.collaboratorManager.getDisplayName(clientId);
            this.clientDecoratorManagers[clientId] = new decorators_1.ClientDecoratorManager(clientId, name, this.nameTagVisibility, this.positionTracker);
        }
        this.clientDecoratorManagers[clientId].updateDecorators();
    }
    updateCoEditorScrollPosition(message) {
        if (message.clientId === this.clientID) {
            return;
        }
        const editorInfo = this.getEditorInfoForClient(message.clientId);
        if (!editorInfo) {
            return;
        }
        // Get the editor that this message was for
        const editor = vscode.window.visibleTextEditors.find((candidate) => {
            return getEditorId(candidate) === editorInfo.id;
        });
        if (!editor) {
            // Didn't find an editor
            return;
        }
        const document = editor.document;
        const fileClient = this.getSharedFileClient(message.fileName);
        const transformedMessage = fileClient.transformScrollSelectionToCurrent(message);
        if (transformedMessage === null) {
            // The message might not "transform" if there are pending selection
            // events. This is important because the selection events are more
            // specific than the viewport -- espcially when the viewport is
            // significantly different in size than the other Participant(s)
            return;
        }
        const scrollStart = fileClient.toVSCodeDocumentPos(transformedMessage.start, document);
        const scrollEnd = fileClient.toVSCodeDocumentPos(transformedMessage.start + transformedMessage.length, document);
        const scrollRange = new vscode.Range(scrollStart, scrollEnd);
        if (fileClient.transformScrollSelectionToCurrent(message) === null) {
            return;
        }
        editor.revealRange(scrollRange, vscode.TextEditorRevealType.Default);
    }
    jumpTo(clientId, viewColumn, explicit = false) {
        const lastKnownPosition = this.positionTracker.getClientPosition(clientId);
        if (explicit) {
            ++this.jumpCount;
        }
        if (!lastKnownPosition) {
            // Either the collaborator is not in a shared document, or we don't know their location.
            if (explicit) {
                ++this.failedJumpCount;
                this.showJumpFailedNotification();
            }
            return;
        }
        const uri = this.pathManager.relativePathToLocalPath(lastKnownPosition.fileName);
        vscode.workspace.openTextDocument(uri)
            .then((document) => {
            return vscode.window.showTextDocument(document, viewColumn, true);
        })
            .then((editor) => {
            this._addPinnedInfoForEditor(editor, this.currentVisibleEditors, clientId);
            this.updatePinIconFromActiveEditor();
            if (editor.visibleRanges[0].intersection(lastKnownPosition.range) !== undefined) {
                return;
            }
            // On the guest, they may have folded the code, which means our
            // jump to selection is going to end up not really showing them
            // anything. So, expand all the folding levels at the line
            // we're going to, and any up to the root of the fold tree.
            vscode.commands.executeCommand('editor.unfold', {
                selectionLines: [lastKnownPosition.range.start.line],
                levels: Number.MAX_VALUE,
                direction: 'up' // Expand parent folds, but not children
            });
            editor.revealRange(lastKnownPosition.range, vscode.TextEditorRevealType.Default);
        });
    }
    pin(editor, userId, split) {
        ++this.pinCount;
        if (!this.positionTracker.getClientPosition(userId)) {
            ++this.failedJumpCount;
            this.showJumpFailedNotification();
            return;
        }
        if (editor) {
            this._addPinnedInfoForEditor(editor, this.currentVisibleEditors, userId);
        }
        let targetEditor = (editor ? editor.viewColumn : vscode.ViewColumn.Active);
        if (split) {
            targetEditor = -2; // Defined in 1.25+ as 'Beside', which menas open a new editor column
        }
        util_1.ExtensionUtil.setCommandContext(commands_1.Commands.pinnedCommandContext, true);
        this.jumpTo(userId, targetEditor);
        this.updateDecorators(userId);
        this.onPinEvent.emit(this.onPinEventName);
    }
    getUsersBeingFollowed() {
        const result = {};
        for (let columnName of Object.keys(this.currentVisibleEditors)) {
            const column = this.currentVisibleEditors[columnName];
            result[column.pinnedClient] = true;
        }
        return result;
    }
    unpinByEditor(editor, explicit = false) {
        const editorId = getEditorId(editor);
        const editorInfo = this.currentVisibleEditors[editorId];
        if (!editorInfo || editorInfo.pinnedClient === -1) {
            // It was not something we thought was pinned.
            return;
        }
        if (explicit) {
            ++this.unpinCount;
        }
        else {
            ++this.autoUnpinCount;
        }
        // If the unpinned client is read-only, remove the decorations
        const clientId = editorInfo.pinnedClient;
        void async function (self) {
            try {
                if (await self.clientAccessCheck().isClientReadOnly(clientId) &&
                    self.clientDecoratorManagers[clientId] &&
                    config.get(config.Key.showReadOnlyUsersInEditor) !== 'always') {
                    self.clientDecoratorManagers[clientId].dispose();
                    delete self.clientDecoratorManagers[clientId];
                }
            }
            catch (err) {
                self.coEditingTrace.error(`Error unpinning read-only participant ${err.message}`);
            }
        }(this);
        editorInfo.pinnedClient = -1;
        // If the active editor is the one we're unpinning, update the command context
        if (getEditorId(this.activeEditor) === editorId) {
            this.setPinned(false);
        }
    }
    isPinned(clientId) {
        return this.getEditorInfoForClient(clientId) !== null;
    }
    unpinByClient(clientId) {
        const editorInfo = this.getEditorInfoForClient(clientId);
        if (!editorInfo) {
            return;
        }
        editorInfo.pinnedClient = -1;
        this.onUnpinEvent.emit(this.onUnpinEventName);
    }
    updatePinableCommandStatus(isPinnable) {
        util_1.ExtensionUtil.setCommandContext(commands_1.Commands.pinnableCommandContext, isPinnable);
    }
    setPinned(isPinned) {
        if (isPinned) {
            this.onPinEvent.emit(this.onPinEventName);
        }
        else {
            this.onUnpinEvent.emit(this.onUnpinEventName);
        }
        util_1.ExtensionUtil.setCommandContext(commands_1.Commands.pinnedCommandContext, isPinned);
    }
    updatePinIconFromActiveEditor() {
        const workspaceFileName = this.activeFileName;
        if (workspaceFileName === null) {
            // No file name on the editor, clearly it's not pinnable.
            this.updatePinableCommandStatus(false);
            return;
        }
        // If we have a file name, all documents might be pinnable
        this.updatePinableCommandStatus(true);
        const editorInfo = this.currentVisibleEditors[getEditorId(this.activeEditor)];
        if (editorInfo && editorInfo.pinnedClient > -1) {
            this.setPinned(true);
        }
        else {
            this.setPinned(false);
        }
    }
    lastKnownFileForClient(clientId) {
        const lastKnownPosition = this.positionTracker.getClientPosition(clientId);
        return lastKnownPosition ? lastKnownPosition.fileName.replace(/^\/*/, '') : undefined;
    }
    onCoEditorSwitchedFile(handler) {
        this.positionTracker.onCoEditorSwitchedFile(handler);
    }
    onCoEditorsJoined(handler) {
        this.coEditorsJoinedEvent.addListener(this.coEditorsJoinedEventName, handler);
    }
    onPin(handler) {
        this.onPinEvent.addListener(this.onPinEventName, handler);
    }
    onUnpin(handler) {
        this.onUnpinEvent.addListener(this.onUnpinEventName, handler);
    }
    onUpdateCoEditorPosition(handler) {
        this.onUpdateCoEditorPositionEvent.addListener(this.onUpdateCoEditorPositionEventName, handler);
    }
    async onWorkspaceSessionChanged(e) {
        const sessionId = e.sessionNumber;
        // We only need to clean up state if someone leaves the session, and they
        // were a co-editor
        if (e.changeType !== VSLS_1.WorkspaceSessionChangeType.Unjoined || !session_1.SessionContext.collaboratorManager.wasCoEditor(sessionId)) {
            return;
        }
        if (this.clientDecoratorManagers[sessionId]) {
            this.clientDecoratorManagers[sessionId].dispose();
            delete this.clientDecoratorManagers[sessionId];
        }
        if (typeof this.highestSendId[sessionId] === 'number') {
            delete this.highestSendId[sessionId];
        }
        // If a viewcolumn was pinned to this participant, unpin it
        this.unpinByClient(sessionId);
    }
    async performUserInitiatedUndo(args) {
        let fileClient = this.getSharedFileClientFromEditor(this.activeEditor);
        let wasHandled = (!!fileClient) && fileClient.undoLastLocalEdit();
        if (wasHandled) {
            return;
        }
        // No file client, or not being handled by the client means it's:
        // - not a file we're tracking
        // - not opened it yet (so we can't undo it)
        // - the client didn't have anything special to do so wants the default
        //   undo behaviour
        vscode.commands.executeCommand('default:undo', args);
    }
    async performUserInitiatedRedo(args) {
        let fileClient = this.getSharedFileClientFromEditor(this.activeEditor);
        let wasHandled = (!!fileClient) && fileClient.redoLastLocalEdit();
        if (wasHandled) {
            return;
        }
        // No file client, or not being handled by the client means it's:
        // - not a file we're tracking
        // - not opened it yet (so we can't undo it)
        // - the client didn't have anything special to do so wants the default
        //   redo behaviour
        vscode.commands.executeCommand('default:redo', args);
    }
    sendCurrentSelectionMessage(forceJumpForId) {
        const activeEditor = this.activeEditor;
        if (!activeEditor) {
            return;
        }
        const document = activeEditor.document;
        let currentSelections = activeEditor.selections;
        if ((!currentSelections || !currentSelections.length) && document) {
            // The user hasn't clicked in the file yet. Consider the position to be at the beginning of the file.
            const pos = document.positionAt(0);
            currentSelections.push(new vscode.Selection(pos, pos));
        }
        this.sendSelectionChangeMessage(document, currentSelections, forceJumpForId);
    }
    get activeFileName() {
        return this.fileNameForEditor(this.activeEditor);
    }
    get activeEditor() {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            // Set the last active editor
            this.lastActiveEditor = activeEditor;
        }
        return this.lastActiveEditor;
    }
    fileNameForEditor(editor) {
        if (!editor || !editor.document) {
            return null;
        }
        const activeUri = editor.document.uri;
        return this.pathManager.localPathToRelativePath(activeUri);
    }
    sendLayoutChangeMessage(fileName, visibleRanges) {
        const fileClient = this.getSharedFileClient(fileName);
        if (!fileName || !fileClient) {
            return;
        }
        fileClient.onDidChangeTextEditorVisibleRange(fileName, visibleRanges);
    }
    sendSelectionChangeMessage(document, selections, forceJumpForId) {
        const fileName = this.pathManager.localPathToRelativePath(document.uri);
        const fileClient = this.getSharedFileClient(fileName);
        if (!fileName || !fileClient) {
            return;
        }
        fileClient.onDidChangeTextEditorSelection(selections, fileName, forceJumpForId);
    }
    fireCoEditorsJoined(joinerIds) {
        session_1.SessionContext.collaboratorManager.coEditorsJoined(joinerIds);
        this.coEditorsJoinedEvent.emit(this.coEditorsJoinedEventName, joinerIds);
    }
    showJumpFailedNotification() {
        vscode.window.showInformationMessage('The target participant is not currently editing a shared document');
    }
    async handleDesync(reason) {
        coauthoringTelemetry_1.CoauthoringTelemetry.ReportDesync(reason);
        await vscode.window.showErrorMessage('You appear to be out of sync. Please rejoin the session.', { modal: util_1.ExtensionUtil.enableModalNotifications });
        await extension_1.extensionCommands.leaveCollaboration();
    }
}
// Message management
Client.sendId = 0;
exports.Client = Client;
class ClientFileData {
    constructor(client, fileName, uri, initialText, bufferManagerTrace, wasDirty) {
        this.client = client;
        this.wasDirty = wasDirty;
        this.remoteEdits = 0;
        this.localEdits = 0;
        this.wasLastEditRemote = false;
        this.isMarkedReadOnlyByOwner = false;
        // Counts time since last edit of opposite type (remote / local): [0] is < 1 sec, [1] is <= 1 <= 5 sec, [2] is > 5 sec
        this.editTransitionCounts = [0, 0, 0];
        this.currentFileName = fileName;
        const host = new class {
            constructor() {
                this.clientID = client.clientID;
                this.clientCount = 10;
                this.trace = bufferManagerTrace;
            }
            applyEdit(edits) {
                const workspaceEdit = new vscode.WorkspaceEdit();
                workspaceEdit.set(uri, edits);
                return vscode.workspace.applyEdit(workspaceEdit);
            }
            postMessage(message) {
                client.postMessage(message);
            }
            updateClientPosition(message) {
                client.updateCoEditorPosition(message);
            }
            undoBufferToMatchContents(contentToMatch) {
                let activeDocument = vscode.window.activeTextEditor.document;
                return stepUndoTillContentMatches(contentToMatch, activeDocument, this.trace);
            }
            performSingleUndo() {
                return new Promise((resolve) => {
                    vscode.commands.executeCommand(`default:undo`, null).then(() => {
                        resolve();
                    });
                });
            }
        };
        this.bufferManager = new vscodeBufferManager_1.VSCodeBufferManager(host, fileName, initialText);
    }
    onDidChangeTextDocument(e) {
        if (this.isMarkedReadOnlyByOwner) {
            return;
        }
        this.updateEditTelemetry(/* isRemoteEdit */ this.waitingForRemoteEditsToBeApplied());
        this.bufferManager.onDidChangeTextDocument(e);
    }
    onDidChangeTextEditorSelection(selections, convertedFileName, forceJumpForId) {
        if (this.isMarkedReadOnlyByOwner) {
            return;
        }
        this.bufferManager.onDidChangeTextEditorSelection(selections, convertedFileName, forceJumpForId);
    }
    onDidChangeTextEditorVisibleRange(fileName, visibleRanges) {
        this.bufferManager.onDidChangeTextEditorVisibleRanges(fileName, visibleRanges);
    }
    onIncomingMessage(message, serverVersionNumber, messageProcessingBehavior = vscodeBufferManager_1.CoeditingIncomingMessageBehavior.QueueAndProcess) {
        this.bufferManager.onIncomingMessage(message, serverVersionNumber, messageProcessingBehavior);
    }
    getStatus() {
        let status = this.bufferManager.getBufferManagerStatus();
        return `sv ${status.serverVersion}, unack ${status.unacknowledgedCount}, remotequeue: ${status.remoteMessagesQueue}`;
    }
    waitingForRemoteEditsToBeApplied() {
        return this.bufferManager.getBufferManagerStatus().waitingForRemoteEditsToBeApplied;
    }
    getBufferContent() {
        return this.bufferManager.getBufferManagerStatus().collabBufferText;
    }
    updateDirtyState(dirty) {
        let result = false;
        if (!this.wasDirty && !dirty) {
            result = true;
        }
        this.wasDirty = dirty;
        return result;
    }
    /**
     * Creates a snapshot of this shared file for late join purposes.
     */
    takeSnapshot() {
        this.bufferManager.takeSnapshot();
    }
    getSavedSnapshotOrFallback(fileHashCode) {
        return this.bufferManager.getSavedSnapshotOrFallback(fileHashCode);
    }
    getCurrentHistory() {
        return this.bufferManager.getCurrentHistory();
    }
    undoLastLocalEdit() {
        return this.bufferManager.undoLastLocalEdit();
    }
    redoLastLocalEdit() {
        return this.bufferManager.redoLastLocalEdit();
    }
    clearUndoStateDueToDocumentClosing() {
        this.bufferManager.clearUndoStateDueToDocumentClosing();
    }
    get fileName() {
        return this.currentFileName;
    }
    updateFileName(newFileName) {
        this.currentFileName = newFileName;
        this.bufferManager.updateFileName(this.currentFileName);
    }
    /**
     * Synchronizes the OT algorithm state for this file with the sharer's.
     */
    initializeHistory(fileOpenAcknowledgeMsg) {
        this.bufferManager.initializeHistory(fileOpenAcknowledgeMsg);
        this.isMarkedReadOnlyByOwner = fileOpenAcknowledgeMsg.isReadOnly;
    }
    updateInitialHistoryHighWatermark(serverVersionNumber) {
        this.bufferManager.updateInitialHistoryHighWatermark(serverVersionNumber);
    }
    /**
     * Drains and processes the queue of remote messages.
     */
    drainMessageQueue() {
        this.bufferManager.processQueuedMessages();
    }
    transformScrollSelectionToCurrent(message) {
        return this.bufferManager.transformScrollSelectionToCurrent(message);
    }
    /**
     * Converts an offset in collaboration buffer coordinates to a VS Code position for the given document.
     */
    toVSCodeDocumentPos(collabOffset, document) {
        return this.bufferManager.toVSCodeDocumentPos(collabOffset, document);
    }
    dispose() {
        coauthoringTelemetry_1.CoauthoringTelemetry.BufferClosed(this.languageId, this.localEdits, this.remoteEdits, this.editTransitionCounts, this.bufferManager.numberOfLocalUndos, // Local undos: currently unsupported
        this.bufferManager.numberOfRemoteUndos, // Remote undos: currently unsupported
        0, // Highlights: currently unsupported
        0 // Latency: currently unsupported
        );
    }
    setLanguageId(languageId) {
        this.languageId = languageId;
    }
    updateEditTelemetry(isRemoteEdit) {
        const lastEditTime = this.timeOfLastEdit;
        const now = this.timeOfLastEdit = Date.now();
        const delta = now - lastEditTime;
        if (isRemoteEdit) {
            this.remoteEdits += 1;
        }
        else {
            this.localEdits += 1;
        }
        if (this.wasLastEditRemote === isRemoteEdit) {
            return;
        }
        this.wasLastEditRemote = isRemoteEdit;
        const isFirstEdit = (this.remoteEdits + this.localEdits === 1);
        if (isFirstEdit) {
            return;
        }
        if (delta > ClientFileData.slowEditTransitionTime) {
            this.editTransitionCounts[2] += 1;
        }
        else if (delta < ClientFileData.quickEditTransitionTime) {
            this.editTransitionCounts[0] += 1;
        }
        else {
            this.editTransitionCounts[1] += 1;
        }
    }
}
// Telemetry
ClientFileData.quickEditTransitionTime = 1000; // 1s
ClientFileData.slowEditTransitionTime = 5000; // 5s
exports.ClientFileData = ClientFileData;

//# sourceMappingURL=client.js.map
