"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
const vscode = require("vscode");
const events_1 = require("events");
/**
 * Tracks document positions (in VS Code coordinates) across edits.
 */
class PositionTracker {
    constructor() {
        this.coEditorSwitchedFileEventName = 'coEditorSwitchedFile';
        this.clientPositions = {}; // Maps client ID (session number) to the client's position
        this.coEditorSwitchedFileEvent = new events_1.EventEmitter();
    }
    dispose() {
        this.coEditorSwitchedFileEvent.removeAllListeners();
    }
    onCoEditorSwitchedFile(handler) {
        this.coEditorSwitchedFileEvent.addListener(this.coEditorSwitchedFileEventName, handler);
    }
    setClientPosition(clientId, fileName, document, range, isReversed) {
        const previousPos = this.getClientPosition(clientId);
        const documentUri = document.uri.toString();
        const startOffset = document.offsetAt(range.start);
        const endOffset = document.offsetAt(range.end);
        this.clientPositions[clientId] = {
            fileName,
            documentUri,
            range,
            isReversed,
            startOffset,
            endOffset
        };
        const isRangeChanged = (previousPos)
            // check if the range changed compared with the previous position
            ? (previousPos.range.start !== range.start) || (previousPos.range.end !== range.end)
            // if there is no previous position, this is a first update, so we need to fallback to true
            : true;
        if (!previousPos || previousPos.fileName !== fileName || isRangeChanged) {
            this.coEditorSwitchedFileEvent.emit(this.coEditorSwitchedFileEventName, clientId, fileName);
        }
    }
    onDidChangeTextDocument(fileName, e) {
        Object.keys(this.clientPositions).forEach((clientId) => {
            const position = this.clientPositions[clientId];
            if (!position) {
                return;
            }
            const document = e.document;
            if (position.fileName === fileName) {
                let translatedPosition = position;
                e.contentChanges.forEach((change) => {
                    translatedPosition = PositionTracker.trackForSingleEdit(translatedPosition, document, change);
                });
                this.clientPositions[clientId] = translatedPosition;
            }
        });
    }
    getClientPosition(clientId) {
        return this.clientPositions[clientId];
    }
    static trackForSingleEdit(position, document, change) {
        const newStartOffset = PositionTracker.translateOffset(position.range.start, position.startOffset, document, change);
        const newEndOffset = PositionTracker.translateOffset(position.range.end, position.endOffset, document, change);
        const newTrackedPosition = Object.assign({}, position);
        const newStartPos = document.positionAt(newStartOffset);
        const newEndPos = document.positionAt(newEndOffset);
        const newRange = new vscode.Range(newStartPos, newEndPos);
        newTrackedPosition.startOffset = newStartOffset;
        newTrackedPosition.endOffset = newEndOffset;
        newTrackedPosition.range = newRange;
        return newTrackedPosition;
    }
    static translateOffset(pos, oldOffset, document, change) {
        if (change.range.start.isAfter(pos)) {
            // Change is completely after pos: no-op
            return oldOffset;
        }
        if (change.range.end.isBeforeOrEqual(pos)) {
            // Change is completely before or ends on pos: translate by net change length
            const netChangeLength = change.text.length - change.rangeLength;
            const newOffset = oldOffset + netChangeLength;
            return newOffset;
        }
        // Change overlaps or starts on pos: pos moves to the end of the new text
        const changeStartOffset = document.offsetAt(change.range.start);
        const changeEndOffset = changeStartOffset + change.text.length;
        return changeEndOffset;
    }
}
exports.PositionTracker = PositionTracker;

//# sourceMappingURL=positionTracker.js.map
