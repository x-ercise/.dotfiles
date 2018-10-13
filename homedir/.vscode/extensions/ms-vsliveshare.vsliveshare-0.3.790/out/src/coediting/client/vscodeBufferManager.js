"use strict";
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
Object.defineProperty(exports, "__esModule", { value: true });
const collabBuffer_1 = require("../common/collabBuffer");
const vscode = require("vscode");
const OTAlgorithm_1 = require("../common/OTAlgorithm");
const VSLS_1 = require("../../contracts/VSLS");
const coauthoringService_1 = require("../common/coauthoringService");
const coeditingUtils_1 = require("../common/coeditingUtils");
const util_1 = require("../../util");
const traceSource_1 = require("../../tracing/traceSource");
const TransformManager_1 = require("../common/TransformManager");
const session_1 = require("../../session");
const config = require("../../config");
class MessageAndVersionNumber {
    constructor(message, serverVersionNumber) {
        this.message = message;
        this.serverVersionNumber = serverVersionNumber;
        /* empty */
    }
}
exports.MessageAndVersionNumber = MessageAndVersionNumber;
var CoeditingIncomingMessageBehavior;
(function (CoeditingIncomingMessageBehavior) {
    CoeditingIncomingMessageBehavior[CoeditingIncomingMessageBehavior["None"] = 0] = "None";
    CoeditingIncomingMessageBehavior[CoeditingIncomingMessageBehavior["Queue"] = 1] = "Queue";
    CoeditingIncomingMessageBehavior[CoeditingIncomingMessageBehavior["QueueAndProcess"] = 2] = "QueueAndProcess";
})(CoeditingIncomingMessageBehavior = exports.CoeditingIncomingMessageBehavior || (exports.CoeditingIncomingMessageBehavior = {}));
class PendingEdit {
    constructor(algorithmState, pendingEdit) {
        this.algorithmState = algorithmState;
        this.pendingEdit = pendingEdit;
    }
}
function isDanglingNewLine(text, start) {
    return (text.length > 0) && (text.charCodeAt(0) === 10) /*\n*/ && ((start.line > 0) || (start.character > 0));
}
var LastChangeSource;
(function (LastChangeSource) {
    LastChangeSource[LastChangeSource["Unknown"] = 0] = "Unknown";
    LastChangeSource[LastChangeSource["Local"] = 1] = "Local";
    LastChangeSource[LastChangeSource["Remote"] = 2] = "Remote";
})(LastChangeSource || (LastChangeSource = {}));
var DirectionOfTransform;
(function (DirectionOfTransform) {
    DirectionOfTransform[DirectionOfTransform["Back"] = 0] = "Back";
    DirectionOfTransform[DirectionOfTransform["Foward"] = 1] = "Foward";
})(DirectionOfTransform || (DirectionOfTransform = {}));
const SELECTION_SCROLLING_DEBOUNCE_TIMEOUT = 100;
class VSCodeBufferManager {
    constructor(host, fileName, initialText, diagnosticTrace = false) {
        this.saveSnapshots = {};
        this.pendingApplicationOfRemoteEdit = null;
        this.localChangesQueue = [];
        this.remoteMessagesQueue = [];
        this.highestQueuedEventId = -2;
        this.localToRemoteTransitions = [];
        this.localRedoStack = [];
        this.initialHistoryHighWaterMark = -1;
        this.performingUndo = false;
        this.lastChangeSource = LastChangeSource.Unknown;
        this.hasEverHadALocalEdit = false;
        this.redoWouldRedoLocalUndo = false;
        this.localUndoCount = 0;
        this.remoteUndoCount = 0;
        this.selectionChangedDebounce = null;
        this.scrollHappenedDebounce = [];
        this.host = host;
        this.diagnosticTrace = diagnosticTrace;
        this.collabBuffer = new collabBuffer_1.CollabBuffer(initialText);
        this.fileName = fileName;
        let self = this;
        const algorithmHost = new class {
            constructor() {
                this.clientID = host.clientID;
                this.clientCount = host.clientCount;
                this.trace = host.trace;
            }
            get fileName() {
                return self.fileName;
            }
            postMessage(msg) {
                host.postMessage(msg);
            }
        };
        this.otAlgorithm = new OTAlgorithm_1.OTAlgorithm(algorithmHost, this.diagnosticTrace);
    }
    get numberOfLocalUndos() {
        return this.localUndoCount;
    }
    get numberOfRemoteUndos() {
        return this.remoteUndoCount;
    }
    updateFileName(newFileName) {
        this.fileName = newFileName;
    }
    onDidChangeTextDocument(e) {
        this.localChangesQueue.push(e);
        this.processQueuedMessages();
    }
    onDidChangeTextEditorVisibleRanges(fileName, ranges) {
        if (!session_1.SessionContext.EnableVerticalScrolling || ranges.length < 1) {
            return;
        }
        if (this.seenSelectionWithinDebouncePeriod()) {
            // We want to keep debouncing the selection (e.g. dropping other
            // scrolls) when we see a stream of scroll events. We only need short
            // period of idle before we pick them up again. This is a trade off;
            // if you're changing selection, and then scrolling the selection
            // out of view quickly, you'll drop the scroll events. But this is
            // an OK trade off to make sure the follower doesn't see flickering
            //
            // Note: By default, VS Code will do selection + one scroll event.
            // However, if the customer has smooth scrolling enabled, it will be
            // selection + N scroll events (however many needed to move the
            // viewport), which is why this resets the timer rather than clearing
            this.resetSelectionDebounce();
            return;
        }
        const viewport = ranges[0];
        const bufferOffsetStart = this.toCollabOffset(viewport.start);
        const bufferOffsetEnd = this.toCollabOffset(viewport.end);
        const length = bufferOffsetEnd - bufferOffsetStart;
        const serverVersion = this.otAlgorithm.getOperationalTransformStatus().serverVersion;
        const layoutChangeMsg = coauthoringService_1.MessageFactory.LayoutScrollMessage(this.host.clientID, fileName, serverVersion, bufferOffsetStart, length);
        // Delay the handling of scroll messages by some time period. This is because
        // when the viewports are miss-matched between clients, a large viewport
        // will result being asked to bring lines 0-100 into view, but the client
        // can only display 0-20, so it only shows 0-20. This isn't normally a
        // problem until a there is a selection change in the same 'operation'
        // e.g. the user typed something at the bottom of the range of the
        // smaller viewport. E.g. 0-100 range on host, 0-20 on guest, edit happens
        // on line 21, we see: scroll, edit, selection events as discrete events
        // from VS Code (And receive them in the same way). This causes the smaller
        // viewport to flick up to the top of the 0-100 range, and then immediately
        // rescroll the line of the section which is where the cursor actually is.
        // This results in a lag of the scroll _starting_, but no delay during
        // the scroll.
        let scrollHappenedId = setTimeout(() => {
            const indexOfTimeoutId = this.scrollHappenedDebounce.indexOf(scrollHappenedId);
            if (indexOfTimeoutId > -1) {
                this.scrollHappenedDebounce.splice(indexOfTimeoutId, 1);
            }
            this.host.postMessage(layoutChangeMsg);
        }, SELECTION_SCROLLING_DEBOUNCE_TIMEOUT);
        this.scrollHappenedDebounce.push(scrollHappenedId);
    }
    clearSelectionDebounce() {
        if (this.selectionChangedDebounce === null) {
            return;
        }
        clearTimeout(this.selectionChangedDebounce);
        this.selectionChangedDebounce = null;
    }
    clearScrollHappenedDebounce() {
        this.scrollHappenedDebounce.forEach((id) => {
            clearTimeout(id);
        });
        this.scrollHappenedDebounce = [];
    }
    seenSelectionWithinDebouncePeriod() {
        return this.selectionChangedDebounce !== null;
    }
    havePendingScrolls() {
        return (this.scrollHappenedDebounce.length > 0);
    }
    resetSelectionDebounce() {
        this.clearSelectionDebounce();
        this.clearScrollHappenedDebounce();
        this.selectionChangedDebounce = setTimeout(() => this.clearSelectionDebounce(), SELECTION_SCROLLING_DEBOUNCE_TIMEOUT);
    }
    onDidChangeTextEditorSelection(selections, fileName, forceJumpForId) {
        if (this.pendingApplicationOfRemoteEdit) {
            // This event was caused by the remote edit being applied, which caused the selection to change. VS Code already deals with
            // repositioning the decorators, so drop this event.
            return;
        }
        // TODO: Support multiple selections (right now VS does a single big
        // selection combining all selections). For now just use the primary
        // selection which is at index 0.
        const primarySelection = selections[0];
        const offsetStart = this.toCollabOffset(primarySelection.start);
        const offsetEnd = this.toCollabOffset(primarySelection.end);
        const length = offsetEnd - offsetStart;
        const serverVersion = this.otAlgorithm.getOperationalTransformStatus().serverVersion;
        const selectionChangeMsg = coauthoringService_1.MessageFactory.SelectionChangeMessage(this.host.clientID, fileName, serverVersion, offsetStart, length, primarySelection.isReversed, forceJumpForId);
        this.host.postMessage(selectionChangeMsg);
        // We received a selection event, so if we need to reset the debounce
        // timeout, so that any scrolls that happen within a time period are
        // dropped, since selection gives the most specific focusing behaviour.
        this.resetSelectionDebounce();
    }
    onIncomingMessage(message, serverVersionNumber, processingBehavior = CoeditingIncomingMessageBehavior.QueueAndProcess) {
        if (serverVersionNumber <= this.highestQueuedEventId) {
            return;
        }
        this.highestQueuedEventId = serverVersionNumber;
        this.remoteMessagesQueue.push(new MessageAndVersionNumber(message, serverVersionNumber));
        if (processingBehavior === CoeditingIncomingMessageBehavior.Queue) {
            // If we're only being asked to queue, then don't process any items
            // in the queue. That will be handled at a later time.
            return;
        }
        this.processQueuedMessages();
    }
    /**
     * Converts an offset in collaboration buffer coordinates to a VS Code position for the given document.
     */
    toVSCodeDocumentPos(collabOffset, document) {
        const collabPos = this.collabBuffer.positionAt(collabOffset);
        const vsCodePos = new vscode.Position(collabPos.line, collabPos.character);
        return vsCodePos;
    }
    /**
     * Converts a VS Code position to an offset in collaboration buffer coordinates for this buffer.
     */
    toCollabOffset(vsCodePos) {
        const collabPos = new collabBuffer_1.CollabBufferPosition(vsCodePos.line, vsCodePos.character);
        const collabOffset = this.collabBuffer.offsetAt(collabPos);
        return collabOffset;
    }
    getBufferManagerStatus() {
        let operationalTransformStatus = this.otAlgorithm.getOperationalTransformStatus();
        return {
            serverVersion: operationalTransformStatus.serverVersion,
            unacknowledgedCount: operationalTransformStatus.unacknowledgedCount,
            waitingForRemoteEditsToBeApplied: !!this.pendingApplicationOfRemoteEdit,
            localChangesQueue: this.localChangesQueue.length,
            remoteMessagesQueue: this.remoteMessagesQueue.length,
            collabBufferText: this.collabBuffer.getContent()
        };
    }
    getCurrentHistory() {
        const history = this.otAlgorithm.getCurrentHistory();
        return history.map((serverVersion) => {
            return {
                message: serverVersion.Message,
                serverVersionNumber: serverVersion.serverVersionNumber
            };
        });
    }
    initializeHistory(fileOpenAcknowledgeMsg) {
        const receivedHistory = fileOpenAcknowledgeMsg.history;
        const initialHistory = [
            new TransformManager_1.ServerVersion(fileOpenAcknowledgeMsg.startServerVersionNumber, null)
        ];
        // Use the received history to initialize our own OT state to be at the
        // same level. Note, there may be messages that happened after the remote
        // file was saved. We can't just splat those changes into the history, we
        // have to allow them to process through the normal mechanisms (e.g.
        // treat them like we got them as discrete messages from other clients)
        receivedHistory.forEach((serverVersion) => {
            if (serverVersion.serverVersionNumber <= fileOpenAcknowledgeMsg.savedVersionNumber) {
                initialHistory.push(new TransformManager_1.ServerVersion(serverVersion.serverVersionNumber, serverVersion.message));
                this.highestQueuedEventId = serverVersion.serverVersionNumber;
                return;
            }
            if (serverVersion.serverVersionNumber > this.initialHistoryHighWaterMark) {
                this.initialHistoryHighWaterMark = serverVersion.serverVersionNumber;
            }
            // Since these messages are after the saved revision, process them
            // like any other normal remotely received messages.
            const messageWithDefaults = coauthoringService_1.MessageFactory.CoauthoringMessage(serverVersion.message);
            this.onIncomingMessage(messageWithDefaults, serverVersion.serverVersionNumber, CoeditingIncomingMessageBehavior.Queue);
        });
        this.otAlgorithm.setInitialHistory(initialHistory);
    }
    updateInitialHistoryHighWatermark(serverVersionNumber) {
        if (this.initialHistoryHighWaterMark > serverVersionNumber) {
            return;
        }
        this.initialHistoryHighWaterMark = serverVersionNumber;
    }
    undoLastLocalEdit() {
        this.host.trace.verbose(`Undo: Received Local Undo Request for ${traceSource_1.TraceFormat.formatPath(this.fileName)}`);
        if (this.performingUndo) {
            // If we're already undoing a change, we should drop any other undo
            // requests that come. This means we're going to tell a fib saying
            // we 'handled it', when in reality, we're just droping the request
            // on the floor.
            this.host.trace.verbose('Undo: Already performing undo, not handling this undo');
            return true;
        }
        // If the last change was a local change, we don't need to explicitly
        // handle it -- the editor will undo it, and we'll see the changes, and
        // propogate. Additionally, if you share a session, and undo before making
        // any changes, we need to let VS handle that too
        if ((this.lastChangeSource === LastChangeSource.Local && this.localToRemoteTransitions.length < 1)
            || (this.lastChangeSource === LastChangeSource.Unknown && this.localToRemoteTransitions.length === 0)) {
            this.localUndoCount++;
            this.redoWouldRedoLocalUndo = true;
            this.host.trace.verbose(`Undo: Last change was local, let editor handle. Source: ${this.lastChangeSource}, Count: ${this.localToRemoteTransitions.length}`);
            return false;
        }
        // We have something we might be able to undo (E.g. we received some
        // remote edits). However, we've never seen any local edits, and we've
        // been monitoring all edits to this document, so we know there are none
        // from before time. This means nothing for the editor to actually undo
        if (!this.hasEverHadALocalEdit) {
            // Claim we've handled it, since theres nothing for us to undo before
            // the remote edits.
            this.host.trace.verbose('Undo: No local edits ever seen, with remote edits, nothing to undo');
            return true;
        }
        if (this.lastChangeSource === LastChangeSource.Local && this.localToRemoteTransitions.length > 0) {
            // When there is a local edit, and we have some transitions (e.g. we're
            // on the leading edge of local changes), we need to let the editor do
            // the undo locally, but check the buffer state after to see if we're
            // now back to the point in the buffer where we transitioned from remote
            // to local.
            this.host.trace.verbose('Undo: Last edit was local, performing undo to update transitions');
            this.performingUndo = true;
            this.redoWouldRedoLocalUndo = true;
            this.localUndoCount++;
            this.host.performSingleUndo().then(() => {
                this.performingUndo = false;
                const transition = this.localToRemoteTransitions[this.localToRemoteTransitions.length - 1];
                if (this.collabBuffer.getContent() !== transition.beforeTransitionToLocal) {
                    this.host.trace.verbose('Undo: Editor undo complete, but still more that could be undo');
                    // we've got more local edits we might be able to undo so
                    // just leave us where we are.
                    return;
                }
                this.host.trace.verbose('Undo: Reached state of last remote edit. Updating status');
                // We reached the state where we transitioned to the state we had
                // before we saw any local updates, so update to having been remote
                transition.beforeTransitionToLocal = null;
                this.lastChangeSource = LastChangeSource.Remote;
                this.hasEverHadALocalEdit = transition.hadLocalEdits;
            });
            return true;
        }
        // We need to start undoing until this buffer reaches the point where it
        // has the state before any local updates
        coeditingUtils_1.assert(this.localToRemoteTransitions.length > 0, 'No local changes, but no transitions');
        let originalLocalToRemoteTransitions = this.localToRemoteTransitions.length;
        let targetBufferState = this.localToRemoteTransitions[this.localToRemoteTransitions.length - 1];
        let effectOfUndoingNonLocalEdits;
        let bufferBeforeSingleLocalUndo;
        if (!targetBufferState.beforeTransitionToRemote) {
            // We're at a state where there wasn't anything before we applied remote
            // edits. This is to handle the case of late join -- edits are already
            // applied relative to saved state on the host, and we join later, and
            // those deltas from the saved state are applied as edits. In that case
            // we consider the point those edits have completed applying as being
            // the back stop, so consider this case handled since there isn't
            // anything to undo.
            return true;
        }
        this.performingUndo = true;
        this.remoteUndoCount++;
        this.collabBuffer.startCapturingEditsFromUndoing();
        this.host.trace.verbose('Undo: Rolling back buffer to before the last remote edit');
        this.host.undoBufferToMatchContents(targetBufferState.beforeTransitionToRemote).then(() => {
            this.host.trace.verbose('Undo: Reached target buffer state through editor undos');
            effectOfUndoingNonLocalEdits = this.collabBuffer.stopCapturingEditsFromUndoing();
            this.collabBuffer.startCapturingEditsFromUndoing();
            bufferBeforeSingleLocalUndo = this.collabBuffer.getContent();
            return this.host.performSingleUndo();
        }).then(() => {
            coeditingUtils_1.assert(this.localToRemoteTransitions.length === originalLocalToRemoteTransitions, 'Didn\'t expect transitions while we were undoing');
            let effectsOfUndoLocalEdit = this.collabBuffer.stopCapturingEditsFromUndoing();
            let currentStateTransition = this.localToRemoteTransitions.pop();
            let previousStateTransition = (this.localToRemoteTransitions.length > 0) ? this.localToRemoteTransitions[this.localToRemoteTransitions.length - 1] : null;
            // If the buffer state is now the same as it was before the first local
            // edit, then we can remove it -- the next local state to target
            // is behind this one. That is to say or local edits between these two
            // remote transitions have vanished.
            let content = this.collabBuffer.getContent();
            // If the content before the undo matched the content after, that means
            // there are no more local undos, and we can stop trying them.
            const noMoreLocalUndos = (content === bufferBeforeSingleLocalUndo);
            // When we have a previous state, and it's content before the local
            // edit was applied now matches our current buffer state, it means
            // there basically isn't a state transition. If it doesn't match we're
            // still in a world where we're going to want to allow local undos to
            // keep undoing themselves when we attempt an undo
            if (previousStateTransition && previousStateTransition.beforeTransitionToLocal !== content) {
                // Since the undo operation locally might undo one part of the
                // delta between the remote state, and the local state (E.g. the
                // IDE created an undo stop in during the customers edits), so if the
                // customer hits undo again, we'll perform undos of the remote
                // changes again to get to the state "before" the remote edits.
                // Which means we need to update the state we were aiming for.
                this.host.trace.verbose('Undo: Still more local undos; updating state');
                targetBufferState.beforeTransitionToRemote = content;
                this.localToRemoteTransitions.push(targetBufferState);
            }
            if (this.localToRemoteTransitions.length < 1) {
                this.host.trace.verbose('Undo: No more local-remote states changes, cleaning up');
                // We need to fill in the 'back' stop state -- e.g. if someone does
                // undo again, we need to know when we've reverted back all the edits
                // so we need to implicitly push one back into the transition list
                // and assume our last edit was remote
                this.lastChangeSource = LastChangeSource.Remote;
                // Since there are no longer any transitions, but we were undoing
                // a remote edit, we need to consider that we might have reached
                // a point where there are no more local undos to undo. If undoing
                // didn't result in any local changes, we can consider us as having
                // no local edits.
                this.localToRemoteTransitions.push({ beforeTransitionToRemote: content, hadLocalEdits: !noMoreLocalUndos });
                this.hasEverHadALocalEdit = !noMoreLocalUndos;
            }
            // Transform the changes produced by the real into something that conforms
            // to the TextChange interface so we can use existing transform logic to
            // get things into the right ship post this change.
            effectsOfUndoLocalEdit = effectsOfUndoLocalEdit.filter(change => !((change.newLength === 0) && (change.oldLength === 0)));
            const changesToAdjustTo = effectsOfUndoLocalEdit.map((change) => {
                return {
                    start: change.oldPosition,
                    length: change.newLength,
                    newText: change.oldText
                };
            });
            const documentEdits = this.reverseEditsAndConvertToRealEdits(effectOfUndoingNonLocalEdits, changesToAdjustTo);
            this.localRedoStack.push({
                editsToRedo: effectsOfUndoLocalEdit,
                targetBufferState: content
            });
            this.host.trace.verbose('Undo: Reapplying remote edits');
            return this.host.applyEdit(documentEdits);
        }).then(() => {
            this.host.trace.verbose('Undo: Local undo complete');
            this.performingUndo = false;
        });
        return true;
    }
    reverseEditsAndConvertToRealEdits(changesToReverse, changesToAdjustTo, direction = DirectionOfTransform.Back) {
        // We're going to be applying them in the reverse order, (e.g. the last
        // thing we undo is the first thing we need to redo)
        let result = [];
        // Remove empty changes
        changesToReverse = changesToReverse.filter(change => !((change.newLength === 0) && (change.oldLength === 0)));
        let transformer = TransformManager_1.TransformManager.TrackBackwardAcrossChange;
        if (direction === DirectionOfTransform.Foward) {
            transformer = TransformManager_1.TransformManager.TrackForwardAcrossChange;
        }
        // Since the positions of the changes we're reversing (redoing) have changed
        // relative to the real undo (contained in changesToAdjustTo), we need
        // apply each of those real undo changes to get the correct location
        // for reapplying them (e.g 5 chars got deleted, now instead of
        // inserting at 25, we need to insert at 20)
        changesToReverse = changesToReverse.map((change) => {
            // Transform the positions against the change(s) captured by our real undo
            const newPosition = transformer(change.oldPosition, changesToAdjustTo);
            const newEnd = transformer(change.oldEnd, changesToAdjustTo);
            const newLength = newEnd - newPosition;
            const oldPosition = transformer(change.newPosition, changesToAdjustTo);
            const oldEnd = transformer(change.newEnd, changesToAdjustTo);
            const oldLength = oldEnd - oldPosition;
            return {
                newPosition: newPosition,
                newEnd: newEnd,
                newLength: newLength,
                newText: change.oldText,
                oldPosition: oldPosition,
                oldEnd: oldEnd,
                oldLength: oldLength,
                oldText: change.newText
            };
        }).reverse(); // Note: Reverse 'cause we're _redoing_ them, not undoing
        // Now convert these changes into something we want to apply in the
        // editor.
        let vscodeEdits = changesToReverse.map((edit) => {
            return this._mapTextChangeToEditorEdit(edit);
        });
        return vscodeEdits;
    }
    redoLastLocalEdit() {
        if (this.lastChangeSource === LastChangeSource.Local || this.redoWouldRedoLocalUndo) {
            return false;
        }
        if (!config.featureFlags.localRedo) {
            // If the local redo feature is off, we dont want to let the editor
            // redo something while we have a remote edit. Returning true here
            // indiciates to the caller that we don't want VSCode to do anything
            return true;
        }
        // Last edit was remote, but we don't have anything to redo. We don't
        // want the editor to try a redo, so lets claim we handled it.
        if (this.localRedoStack.length < 1) {
            return true;
        }
        coeditingUtils_1.assert(this.localRedoStack.length > 0, 'We don\'t have any items to redo');
        const redoToApply = this.localRedoStack.pop();
        let effectsOfUndoingNonLocalEdits;
        let redos;
        this.performingUndo = true;
        this.collabBuffer.startCapturingEditsFromUndoing();
        this.host.undoBufferToMatchContents(redoToApply.targetBufferState).then(() => {
            effectsOfUndoingNonLocalEdits = this.collabBuffer.stopCapturingEditsFromUndoing();
            // We've reached the state where we should be able to correctly replay the edits
            redos = redoToApply.editsToRedo.filter(change => !((change.newLength === 0) && (change.oldLength === 0)));
            redos = redos.map((change) => {
                return {
                    newPosition: change.oldPosition,
                    newEnd: change.oldEnd,
                    newLength: change.oldLength,
                    newText: change.oldText,
                    oldPosition: change.newPosition,
                    oldEnd: change.newEnd,
                    oldLength: change.newLength,
                    oldText: change.newText
                };
            });
            let redoEdits = redos.map((edit) => {
                return this._mapTextChangeToEditorEdit(edit);
            });
            // Actually apply the redos to the editor
            return this.host.applyEdit(redoEdits);
        }).then(() => {
            // Now we've applied it, we need to update the target undo state
            // so that after we reapply the remote edits we know the correct
            // state to reach
            this.localToRemoteTransitions[this.localToRemoteTransitions.length - 1].beforeTransitionToRemote = this.collabBuffer.getContent();
            // Transform the changes produced by the real into something that conforms
            // to the TextChange interface so we can use exsiting transform logic to
            // get things into the right ship post this change.
            redos = redos.filter(change => !((change.newLength === 0) && (change.oldLength === 0)));
            let changesToAdjustTo = redos.map((change) => {
                return {
                    start: change.newPosition,
                    length: change.oldLength,
                    newText: change.newText
                };
            });
            const documentEdits = this.reverseEditsAndConvertToRealEdits(effectsOfUndoingNonLocalEdits, changesToAdjustTo, DirectionOfTransform.Foward);
            return this.host.applyEdit(documentEdits);
        }).then(() => {
            this.performingUndo = false;
        }).catch(() => {
            this.performingUndo = false;
        });
        return true;
    }
    clearUndoStateDueToDocumentClosing() {
        this.localRedoStack.length = 0;
        this.localToRemoteTransitions.length = 0;
        this.hasEverHadALocalEdit = false;
        // Since we're clearing it, it means we've had this open, and when (if)
        // it gets reopened, we'll assuming changes are remote (likley they'll
        // be replayed) -- even if we issued them locally.
        this.host.trace.verbose(`Undo: Clearing Local Undo State due to document close: ${traceSource_1.TraceFormat.formatPath(this.fileName)}`);
        this.lastChangeSource = LastChangeSource.Remote;
        this.localToRemoteTransitions.push({
            hadLocalEdits: this.hasEverHadALocalEdit,
            beforeTransitionToRemote: this.collabBuffer.getContent(),
        });
    }
    takeSnapshot() {
        const snapshot = this.makeSnapshot();
        this.saveSnapshots[snapshot.hashCode] = snapshot;
    }
    getSavedSnapshotOrFallback(fileHashCode) {
        if (this.saveSnapshots[fileHashCode]) {
            return this.saveSnapshots[fileHashCode];
        }
        const snapshot = this.makeSnapshot();
        snapshot.fallbackText = this.collabBuffer.getContent();
        return snapshot;
    }
    makeSnapshot() {
        const currentContent = this.collabBuffer.getContent();
        const syncStatus = this.otAlgorithm.getOperationalTransformStatus();
        return {
            changes: syncStatus.unacknowledged.map((unack) => unack.rollbackEdits).reverse(),
            hashCode: util_1.calculateFileHash(currentContent),
            serverVersionNumber: syncStatus.serverVersion
        };
    }
    processQueuedMessages() {
        if (this.pendingApplicationOfRemoteEdit !== null) {
            // There is a pending edit we are waiting for, cannot advance now
            this.host.trace.verbose('Skipping step due to pending edit');
            return;
        }
        if (this.diagnosticTrace) {
            coeditingUtils_1.logger.logTrace(this.host.trace, 'step');
            coeditingUtils_1.logger.indent();
            coeditingUtils_1.logger.logTrace(this.host.trace, `before local changes - collabbuffer: ` + coeditingUtils_1.colorize.cyan(JSON.stringify(this.collabBuffer.getContent())));
        }
        // First, we pump all the local changes
        while (this.localChangesQueue.length > 0) {
            let localChange = this.localChangesQueue.shift();
            this._acceptLocalChange(localChange);
        }
        if (this.diagnosticTrace) {
            coeditingUtils_1.logger.logTrace(this.host.trace, `after localchanges - collabbuffer: ` + coeditingUtils_1.colorize.cyan(JSON.stringify(this.collabBuffer.getContent())));
        }
        let continueProcessing = true;
        // Then, we handle remote messages
        while (this.remoteMessagesQueue.length > 0 && continueProcessing) {
            const peekMsg = this.remoteMessagesQueue[0];
            const clientId = peekMsg.message.clientId;
            const msgType = peekMsg.message.messageType;
            switch (msgType) {
                case VSLS_1.MessageType.TextChange:
                    // Certain messages mean we should stop processing the items
                    // until their completed. In that case, we'll signal the loop
                    // to break, and jump to the next interation
                    continueProcessing = this._handleTextChangeMessage(clientId, peekMsg);
                    continue;
                case VSLS_1.MessageType.SelectionChange:
                    try {
                        this._handleSelectionChangeMessageIfMostRecent(clientId, peekMsg);
                    }
                    catch (e) {
                        this.host.trace.error(`Error handling selection change in file: ${traceSource_1.TraceFormat.formatPath(this.fileName)}`);
                        throw e;
                    }
                    break;
                default:
                    const errMsg = `Unexpected message type in buffer manager (${this.fileName}): ${msgType}`;
                    this.host.trace.error(errMsg);
                    this.remoteMessagesQueue.shift();
                    coeditingUtils_1.assert(false, errMsg);
                    break;
            }
        }
        if (this.diagnosticTrace) {
            coeditingUtils_1.logger.unindent();
        }
    }
    _handleTextChangeMessage(forClientId, withMessage) {
        if (forClientId === this.host.clientID) {
            // Becuause this is our own message, it can be processed synchronously
            // and the caller can keep processing any other messages still pending
            // in the remote message queue.
            this.remoteMessagesQueue.shift();
            this.otAlgorithm.acceptTextChangeAcknowledge(withMessage.message, withMessage.serverVersionNumber);
            return true;
        }
        // For remote changes, we want to completely apply them one-at-a-time
        // So start applying the message, but inform the caller that they should
        // hold off processing any other changes.
        this._beginApplyingRemoteChange(withMessage.message, withMessage.serverVersionNumber);
        return false;
    }
    _handleSelectionChangeMessageIfMostRecent(forClientId, withMessage) {
        // We only want to process the last selection change message for a given client ID before the next text
        // change message (or the queue end). Check if there are subsequent selection change messages in the
        // queue for this client ID, and if so, simply ignore this message.
        let foundSubsequentSelectionChange = false;
        for (let i = 1; i < this.remoteMessagesQueue.length; ++i) {
            const msg = this.remoteMessagesQueue[i].message;
            if (msg.clientId === forClientId) {
                foundSubsequentSelectionChange = msg.messageType === VSLS_1.MessageType.SelectionChange;
                break;
            }
        }
        if (!foundSubsequentSelectionChange) {
            // No newer selection change messages found, handle this one.
            const transformedMessage = this.transformSelectionToCurrent(withMessage.message);
            this.host.updateClientPosition(transformedMessage);
        }
        this.remoteMessagesQueue.shift();
    }
    _acceptLocalChange(e) {
        if (this.lastChangeSource === LastChangeSource.Remote && !this.performingUndo) {
            this.host.trace.verbose(`Undo: Transitioning to local for ${traceSource_1.TraceFormat.formatPath(this.fileName)}`);
            this.localToRemoteTransitions[this.localToRemoteTransitions.length - 1].beforeTransitionToLocal = this.collabBuffer.getContent();
        }
        // If we're not undoing changes, we'll change the last change type to
        // local. This is important because when we're undoing our changes, we're
        // going to see the undoing of the remote changes, and the re-application
        // of the remote changes as local (because we're applying them ourselves)
        if (!this.performingUndo) {
            this.hasEverHadALocalEdit = true;
            this.lastChangeSource = LastChangeSource.Local;
            this.redoWouldRedoLocalUndo = false;
            // We got a local change, so we need to clear our redo-stack since
            // we've pushed things forward, and thus we're not logically at the
            // first 'local' edit, rather than moving back through the edit stack
            this.localRedoStack.length = 0;
        }
        // VS Code change events contain changes that are to be applied consecutively
        this.collabBuffer.beginRecording();
        e.contentChanges.forEach(change => {
            let start = new collabBuffer_1.CollabBufferPosition(change.range.start.line, change.range.start.character);
            let end = new collabBuffer_1.CollabBufferPosition(change.range.end.line, change.range.end.character);
            let text = change.text;
            // In case the vs code buffer thinks \n are line endings, and we have a "dangling" \r,
            // prevent that, our (line;col)<->offset will deviate from the vs code one
            if (isDanglingNewLine(text, start)) {
                [text, start] = this._adjustContentAndPositionForNewLineType(text, start);
            }
            this.collabBuffer.applyLocalEdit(start, end, text);
        });
        const [changes, unexpandedChanges] = this.collabBuffer.endRecording();
        this.otAlgorithm.acceptLocalChange(changes, unexpandedChanges);
    }
    _adjustContentAndPositionForNewLineType(text, start) {
        let beforePosition;
        let lineText;
        // We need the immediately previous character to see if it
        // was \n. That might be on the previous line.
        if (start.character === 0) {
            // We're at the start of the line, so need get the previous
            // line and adjust position to the previous lines last char
            lineText = this.collabBuffer.getLineContent(start.line - 1);
            beforePosition = new collabBuffer_1.CollabBufferPosition(start.line - 1, lineText.length - 1);
        }
        else {
            // We're somewhere else in the linem so we just need the
            // previous character in our buffer.
            lineText = this.collabBuffer.getLineContent(start.line);
            beforePosition = new collabBuffer_1.CollabBufferPosition(start.line, start.character - 1);
        }
        // That previous character was in fact a \r, so, we need to move
        // that start position in the buffer back one to accomodate
        // inserting our new line content.
        if (lineText.charCodeAt(beforePosition.character) === 13 /* \r */) {
            // the intent of vscode is to produce at least one new line
            // we need to preserve this intent in the case that our buffer
            // becomes \r\n which will not produce a new line
            start = beforePosition;
            text = '\r\n' + text;
        }
        return [text, start];
    }
    _beginApplyingRemoteChange(message, serverVersionNumber) {
        // Capture the state of the buffer immediately before we apply any remote edits
        // This is to enable us to be able to roll-back to this point, and then actually
        // peform a real undo.
        let insertedTransition = -1;
        if (this.lastChangeSource !== LastChangeSource.Remote) {
            coeditingUtils_1.assert(!this.performingUndo, 'Shouldn\'t see remote changes while undoing');
            this.host.trace.verbose(`Undo: Transitioning to Remote for ${traceSource_1.TraceFormat.formatPath(this.fileName)}`);
            // When we're applying a remote change from the initial history, we
            // dont want to capture the content, because we think of that as part
            // of the initial document, and one can't go "undo" that, since you
            // couldn't have applied any local edits
            const currentBuffer = (serverVersionNumber > this.initialHistoryHighWaterMark) ? this.collabBuffer.getContent() : null;
            insertedTransition = this.localToRemoteTransitions.push({ beforeTransitionToRemote: currentBuffer, hadLocalEdits: this.hasEverHadALocalEdit });
        }
        let originalLastChangeSource = this.lastChangeSource;
        this.lastChangeSource = LastChangeSource.Remote;
        this.redoWouldRedoLocalUndo = false;
        let algoState = this.otAlgorithm.saveState();
        this.collabBuffer.beginRecording();
        this.otAlgorithm.acceptRemoteChange(this.collabBuffer, message, serverVersionNumber);
        let [edits, unexpandedEdits] = this.collabBuffer.endRecording();
        // Filter out the edits that aren't actually doing anything.
        edits = edits.filter(edit => !((edit.newLength === 0) && (edit.oldLength === 0)));
        // lucky us, the OT algorithm wants to ... do nothing on the buffer
        if (edits.length === 0) {
            // Remove the message now it's (effectively) been processed, and
            // get on with processing any more queued messages.
            this.remoteMessagesQueue.shift();
            this.processQueuedMessages();
            return;
        }
        // Undo the changes against the collab buffer, so we can subsequently
        // apply the clear edits against the local buffer.
        this.collabBuffer.applyRemoteEdits(edits.map((e) => {
            return {
                position: e.newPosition,
                length: e.newLength,
                text: e.oldText
            };
        }));
        // Map the raw edits we're processing into actual edits to apply to our
        // real editor, rather than our local buffer
        let vscodeEdits = edits.map((edit) => {
            return this._mapTextChangeToEditorEdit(edit);
        });
        if (this.diagnosticTrace) {
            coeditingUtils_1.logger.logTrace(this.host.trace, `sending edit request to ext host: ` + JSON.stringify(edits));
            coeditingUtils_1.logger.logTrace(this.host.trace, `sending edit request to ext host: ` + JSON.stringify(vscodeEdits));
        }
        // Set a pending edit so any of our other events can merely queue events
        // until the pending edits are processed and we have a stable state again
        this.pendingApplicationOfRemoteEdit = new PendingEdit(algoState, edits);
        this.host.applyEdit(vscodeEdits).then((applied) => {
            if (!applied) {
                this._finishApplyingRemoteChangeFail(originalLastChangeSource, insertedTransition);
                return;
            }
            this._finishApplyingRemoteChangeOK();
        }, (err) => {
            this.host.trace.warning(`Error while applying edits: ${err}`);
            this._finishApplyingRemoteChangeFail(originalLastChangeSource, insertedTransition);
        });
    }
    _mapTextChangeToEditorEdit(change) {
        let oldRange;
        let newText = change.newText;
        const oldText = change.oldText;
        const oldStart = this.collabBuffer.positionAt(change.oldPosition);
        const oldEnd = this.collabBuffer.positionAt(change.oldEnd);
        const isReplacingSingleLF = (change.oldLength === 1) && (change.oldText.charCodeAt(0) === 10);
        const newTextEndsWithLF = (newText.length > 0) && (newText.charCodeAt(newText.length - 1) === 10);
        const newTextEndsWithCRLF = (newText.length > 1) && (newText.endsWith('\r\n'));
        const isReplacingWithSingleLF = (change.newLength === 1) && (change.newText.charCodeAt(0) === 10);
        const oldTextEndsWithLF = (oldText.length > 0) && (oldText.charCodeAt(oldText.length - 1) === 10);
        if (isReplacingSingleLF && newTextEndsWithLF && !newTextEndsWithCRLF) {
            // If we're only adding text, but the collab buffer has automatically included the adjacent LF into the
            // text we're replacing; ignore the added LF to prevent the cursor from teleporting to the next line.
            // But, if the new text ends CRLF (not just an LF), we should leave as it, and VSCode will "Fix up"
            // it's line endings to only insert the LF. If we strip it, it ends up with "cr", which is converted back
            // to LF, and now we have too many lines.
            oldRange = new vscode.Range(oldStart.line, oldStart.character, oldStart.line, oldStart.character);
            newText = newText.substr(0, newText.length - 1);
        }
        else if (isReplacingWithSingleLF && oldTextEndsWithLF) {
            // We're only deleting text, but the collab buffer has automatically included the adjacent LF into the
            // text we're adding; ignore the added LF to prevent the cursor from teleporting to the next line
            const truncatedOldEnd = this.collabBuffer.positionAt(change.oldEnd - 1);
            oldRange = new vscode.Range(oldStart.line, oldStart.character, truncatedOldEnd.line, truncatedOldEnd.character);
            newText = '';
        }
        else {
            oldRange = new vscode.Range(oldStart.line, oldStart.character, oldEnd.line, oldEnd.character);
        }
        return new vscode.TextEdit(oldRange, newText);
    }
    _finishApplyingRemoteChangeOK() {
        let pendingEdit = this.pendingApplicationOfRemoteEdit;
        this.pendingApplicationOfRemoteEdit = null;
        // Ignore the document changes caused by us. They should be in one giant
        // atomic change on this document, because thats how we're applying them
        // to the workspace via the host.
        coeditingUtils_1.assert(this.localChangesQueue.length === 1, `expected a single local change caused by my own edit, but got ${JSON.stringify(this.localChangesQueue)}`);
        this.localChangesQueue.shift();
        // pop the remote change that caused this
        this.remoteMessagesQueue.shift();
        // move the collab buffer forward
        this.collabBuffer.applyRemoteEdits(pendingEdit.pendingEdit.map((ed) => {
            return {
                position: ed.oldPosition,
                length: ed.oldLength,
                text: ed.newText
            };
        }));
        this.processQueuedMessages();
    }
    _finishApplyingRemoteChangeFail(originalLastChangeSource, transitionIndex) {
        this.host.trace.info(`Applying edits to main buffer failed for ${traceSource_1.TraceFormat.formatPath(this.fileName)}`);
        let pendingEdit = this.pendingApplicationOfRemoteEdit;
        this.pendingApplicationOfRemoteEdit = null;
        // We only want to actually pop local/remote transitions if we'd added
        // something to the list, and we're at the same point in the list -- if
        // we hadn't added to the to this list, the originally pushed state is
        // valid, and popping it will remove useful information.
        if ((transitionIndex > -1)
            && (transitionIndex === (this.localToRemoteTransitions.length - 1))
            && (this.lastChangeSource !== originalLastChangeSource)) {
            // Something went wrong applying these updates, which means the buffer
            // state we captured isn't relevant; we need to remove it, and give up.
            this.localToRemoteTransitions.pop();
            this.lastChangeSource = originalLastChangeSource;
        }
        // Because we couldn't apply the edits, we need to roll back all the
        // changes we'd asked the OT state to apply so we can attempt them again
        // in the future.
        this.otAlgorithm.loadState(pendingEdit.algorithmState);
        this.processQueuedMessages();
    }
    transformSelectionToCurrent(scMsg) {
        // Use a dummy text change message and run it through the transform manager to get the equivalent selection
        // transform.
        const tc = coauthoringService_1.MessageFactory.TextChange(scMsg.start, scMsg.length, '');
        const tcMsg = coauthoringService_1.MessageFactory.TextChangeMessage(scMsg.clientId, scMsg.fileName, scMsg.serverVersionNumber, [tc]);
        const transformedTcMessage = this.otAlgorithm.TransformMessageToCurrent(tcMsg);
        return coauthoringService_1.MessageFactory.SelectionChangeMessage(scMsg.clientId, scMsg.fileName, transformedTcMessage.changeServerVersion, transformedTcMessage.changes[0].start, transformedTcMessage.changes[0].length, scMsg.isReversed, scMsg.forceJumpForClientId);
    }
    remoteQueueContainsSelectionChange() {
        return this.remoteMessagesQueue.some((message) => {
            return (message.message.messageType === VSLS_1.MessageType.SelectionChange);
        });
    }
    transformScrollSelectionToCurrent(scMsg) {
        if (this.remoteQueueContainsSelectionChange()) {
            return null;
        }
        // Use a dummy text change message and run it through the transform manager to get the equivalent selection
        // transform.
        const tc = coauthoringService_1.MessageFactory.TextChange(scMsg.start, scMsg.length, '');
        const tcMsg = coauthoringService_1.MessageFactory.TextChangeMessage(scMsg.clientId, scMsg.fileName, scMsg.serverVersionNumber, [tc]);
        const transformedTcMessage = this.otAlgorithm.TransformMessageToCurrent(tcMsg);
        return coauthoringService_1.MessageFactory.LayoutScrollMessage(scMsg.clientId, scMsg.fileName, transformedTcMessage.changeServerVersion, transformedTcMessage.changes[0].start, transformedTcMessage.changes[0].length);
    }
}
exports.VSCodeBufferManager = VSCodeBufferManager;

//# sourceMappingURL=vscodeBufferManager.js.map
