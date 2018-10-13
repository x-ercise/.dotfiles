"use strict";
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
Object.defineProperty(exports, "__esModule", { value: true });
const coauthoringService_1 = require("./coauthoringService");
const TransformManager_1 = require("./TransformManager");
const coeditingUtils_1 = require("./coeditingUtils");
class Edit {
    constructor(position, length, text) {
        this.position = position;
        this.length = length;
        this.text = text;
    }
}
exports.Edit = Edit;
class OTAlgorithmStatus {
    constructor(serverVersion, unacknowledged) {
        this.serverVersion = serverVersion;
        this.unacknowledged = unacknowledged;
        this.unacknowledgedCount = unacknowledged.length;
    }
}
exports.OTAlgorithmStatus = OTAlgorithmStatus;
class OTAlgorithmState {
    constructor(currentServerVersionNumber, unacknowledgedChanges) {
        this.currentServerVersionNumber = currentServerVersionNumber;
        this.unacknowledgedChanges = unacknowledgedChanges;
    }
}
exports.OTAlgorithmState = OTAlgorithmState;
class OTAlgorithm {
    constructor(host, diagnosticTrace) {
        this.unacknowledgedChanges = new Array();
        this.host = host;
        this.diagnosticTrace = diagnosticTrace;
        const transformHost = new class {
            constructor() {
                this.trace = host.trace;
            }
            get fileName() {
                return host.fileName;
            }
        };
        this.transformManager = new TransformManager_1.TransformManager(transformHost);
    }
    getOperationalTransformStatus() {
        return new OTAlgorithmStatus(this.transformManager.CurrentServerVersionNumber, this.unacknowledgedChanges);
    }
    getCurrentHistory() {
        return this.transformManager.CurrentHistory;
    }
    /**
     * Sets the underlying transform manager's history.
     */
    setInitialHistory(serverVersions) {
        this.transformManager.setInitialHistory(serverVersions);
    }
    /**
     * Save the state of this class such that it can be restored via `loadState`.
     */
    saveState() {
        let currentServerVersionNumber = this.transformManager.CurrentServerVersionNumber;
        let unacknowledgedChanges = [];
        for (let i = 0; (i < this.unacknowledgedChanges.length); ++i) {
            unacknowledgedChanges.push(this.unacknowledgedChanges[i].clone());
        }
        return new OTAlgorithmState(currentServerVersionNumber, unacknowledgedChanges);
    }
    /**
     * Restore a previously saved state of this class.
     */
    loadState(state) {
        this.transformManager.RollbackTo(state.currentServerVersionNumber);
        this.unacknowledgedChanges = state.unacknowledgedChanges;
    }
    /**
     * Accept (react to) a local original (user made) change.
     */
    acceptLocalChange(originalChanges, unexpandedChanges) {
        if (this.diagnosticTrace) {
            coeditingUtils_1.logger.log(`acceptOriginalBufferChange: ${JSON.stringify(originalChanges)}`);
            coeditingUtils_1.logger.indent();
        }
        let changes = OTAlgorithm._toTextChangeArr(unexpandedChanges);
        let message = coauthoringService_1.MessageFactory.TextChangeMessage(this.host.clientID, this.host.fileName, this.transformManager.CurrentServerVersionNumber, changes);
        this.unacknowledgedChanges.push(new UnacknowledgedChange(message, originalChanges));
        this.host.postMessage(message);
        if (this.diagnosticTrace) {
            coeditingUtils_1.logger.unindent();
        }
    }
    /**
     * Accept (react to) a remote change.
     */
    acceptRemoteChange(buffer, message, eventId) {
        if (this.diagnosticTrace) {
            coeditingUtils_1.logger.log(`acceptRemoteChange: ${JSON.stringify(message)}`);
            coeditingUtils_1.logger.indent();
        }
        coeditingUtils_1.assert(message.clientId !== this.host.clientID, 'Changes must be from a remote client');
        if (message.clientId === this.host.clientID) {
            if (this.diagnosticTrace) {
                coeditingUtils_1.logger.unindent();
            }
            return;
        }
        // Undo our unacknowledged changes
        if (this.diagnosticTrace) {
            coeditingUtils_1.logger.log(`beginning to undo unacknowledged changes.`);
            coeditingUtils_1.logger.indent();
        }
        // Apply the unacknoweldged changes in reverse order to slowly reach the
        // original state so we can apply the actual remote changes.
        for (let i = this.unacknowledgedChanges.length - 1; (i >= 0); --i) {
            this._applyUndoChangeOnBuffer(buffer, this.unacknowledgedChanges[i].previousVersion);
        }
        if (this.diagnosticTrace) {
            coeditingUtils_1.logger.unindent();
            coeditingUtils_1.logger.log(`finished undo of unacknowledged changes.`);
            coeditingUtils_1.logger.log(`beginning to apply server message.`);
            coeditingUtils_1.logger.indent();
        }
        // Apply the remote change and update our knowledge of what the server's state is.
        // We must first rebase the remote change to the latest server truth.
        // Then, we can safely apply it on our buffer which matches the latest server truth (due to our undo above).
        // Finally, we will save the forward operation and update the server truth to include this remote change.
        let adjustedMessage = this.transformManager.TransformMessageToCurrent(message);
        this._applyOperationOnBuffer(buffer, adjustedMessage);
        this.transformManager.AddToServersionHistory(eventId, message, adjustedMessage);
        if (this.diagnosticTrace) {
            coeditingUtils_1.logger.unindent();
            coeditingUtils_1.logger.log(`finished applying server message.`);
            coeditingUtils_1.logger.log(`beginning to redo unacknowledged changes.`);
            coeditingUtils_1.logger.indent();
        }
        for (let i = 0; (i < this.unacknowledgedChanges.length); ++i) {
            let redoMessage = this.unacknowledgedChanges[i].message;
            let adjustedRedoMessage = this.transformManager.TransformMessageToCurrent(redoMessage);
            let unacknowledgedChangeEdits = this._applyOperationOnBuffer(buffer, adjustedRedoMessage);
            this.unacknowledgedChanges[i].previousVersion = unacknowledgedChangeEdits;
            this.transformManager.AddToServersionHistory(++eventId, redoMessage, adjustedRedoMessage);
        }
        this.transformManager.RemoveUnacknowledgedChangesFromServerVersionHistory(this.unacknowledgedChanges.length);
        if (this.diagnosticTrace) {
            coeditingUtils_1.logger.unindent();
            coeditingUtils_1.logger.log(`finished redo of unacknowledged changes.`);
            coeditingUtils_1.logger.unindent();
        }
    }
    _applyUndoChangeOnBuffer(buffer, changes) {
        let edits = new Array(changes.length);
        for (let i = 0; (i < changes.length); ++i) {
            let c = changes[i];
            edits[i] = new Edit(c.newPosition, c.newLength, c.oldText);
        }
        buffer.applyRemoteEdits(edits);
    }
    _applyOperationOnBuffer(buffer, message) {
        // TODO@Cascade: The only complication here is the extra checking of edits for invalid or overlapping edits.
        coeditingUtils_1.assert(message.changeServerVersion === this.transformManager.CurrentServerVersionNumber, 'Cannot apply change on buffer due to different contexts.');
        if (message.changeServerVersion !== this.transformManager.CurrentServerVersionNumber) {
            return;
        }
        let edits = new Array(message.changes.length);
        let prevStart = -1, prevEnd = -1;
        for (let changeIndex = 0; (changeIndex < message.changes.length); ++changeIndex) {
            let change = message.changes[changeIndex];
            let start = change.start;
            let end = change.start + change.length;
            // TODO@Cascade: the transformation function generates invalid and overlapping edits.
            // Here we eliminate overlapping edits
            {
                let newStart = Math.max(prevEnd, start);
                let newEnd = Math.max(prevEnd, end);
                if (newStart !== start || newEnd !== end) {
                    if (this.diagnosticTrace) {
                        coeditingUtils_1.logger.log(coeditingUtils_1.colorize.red(`warning`) + `: overlapping edits: position: ${start}, length: ${end - start} has been clamped to position: ${newStart}, length: ${newEnd - newStart}`);
                    }
                    start = newStart;
                    end = newEnd;
                }
            }
            // Here we clamp edits which are out of bounds
            {
                const max = buffer.getMaximumOffset();
                let newStart = Math.min(Math.max(0, start), max);
                let newEnd = Math.min(Math.max(newStart, end), max);
                if (newStart !== start || newEnd !== end) {
                    if (this.diagnosticTrace) {
                        coeditingUtils_1.logger.log(coeditingUtils_1.colorize.red(`warning`) + `: edit out of bounds: position: ${start}, length: ${end - start} has been clamped to position: ${newStart}, length: ${newEnd - newStart}`);
                    }
                    start = newStart;
                    end = newEnd;
                }
            }
            prevStart = start;
            prevEnd = end;
            edits[changeIndex] = new Edit(start, end - start, change.newText);
        }
        let undoEdits = buffer.applyRemoteEdits(edits);
        return undoEdits;
    }
    /**
     * Accept (react to) the server acknowledging a message sent by us.
     */
    acceptTextChangeAcknowledge(message, eventId) {
        if (this.diagnosticTrace) {
            coeditingUtils_1.logger.log(`acceptTextChangeAcknowledge`);
            coeditingUtils_1.logger.indent();
        }
        try {
            coeditingUtils_1.assert(message.clientId === this.host.clientID, 'Changes must a change we initiated');
            if (message.clientId !== this.host.clientID) {
                return;
            }
            // Our unacknowledged change got acknowledged: delete the 1st unacknowledged change.
            let unacknowledgedChange = this.unacknowledgedChanges[0];
            this.unacknowledgedChanges.splice(0, 1);
            this.transformManager.AddToServersionHistory(eventId, unacknowledgedChange.message, null);
        }
        finally {
            if (this.diagnosticTrace) {
                coeditingUtils_1.logger.unindent();
            }
        }
    }
    TransformMessageToCurrent(message) {
        return this.transformManager.TransformMessageToCurrent(message);
    }
    static _toTextChangeArr(changes) {
        let result = new Array(changes.length);
        for (let i = (changes.length - 1); (i >= 0); --i) {
            let change = changes[i];
            result[i] = coauthoringService_1.MessageFactory.TextChange(change.oldPosition, change.oldLength, change.newText);
        }
        return result;
    }
}
exports.OTAlgorithm = OTAlgorithm;
class UnacknowledgedChange {
    constructor(message, previousVersion) {
        this.message = message;
        this.previousVersion = previousVersion;
        this.rollbackEdits = new Array(previousVersion.length);
        for (let i = 0; (i < previousVersion.length); ++i) {
            let c = previousVersion[i];
            this.rollbackEdits[i] = coauthoringService_1.MessageFactory.TextChange(c.newPosition, c.newLength, c.oldText);
        }
    }
    clone() {
        return new UnacknowledgedChange(this.message, this.previousVersion);
    }
}
exports.UnacknowledgedChange = UnacknowledgedChange;

//# sourceMappingURL=OTAlgorithm.js.map
