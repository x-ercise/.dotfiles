"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
const coeditingUtils_1 = require("./coeditingUtils");
const textChange_1 = require("./textChange");
const prefixSumComputer_1 = require("./prefixSumComputer");
const util_1 = require("../../util");
/**
 * A (0;0)-origin position
 */
class CollabBufferPosition {
    constructor(line, character) {
        this.line = line;
        this.character = character;
    }
}
exports.CollabBufferPosition = CollabBufferPosition;
class InternalEdit {
    constructor(offset, length, start, end, oldText, newText) {
        this.offset = offset;
        this.length = length;
        this.start = start;
        this.end = end;
        this.oldText = oldText;
        this.newText = newText;
    }
}
class InternalOffsetEdit {
    constructor(index, offset, length, text) {
        this.index = index;
        this.offset = offset;
        this.length = length;
        this.text = text;
    }
}
function insertIntoNewArray(target, insertIndex, insertArr) {
    const before = target.slice(0, insertIndex);
    const after = target.slice(insertIndex);
    return before.concat(insertArr, after);
}
class CollabBuffer {
    constructor(initialTextBuffer) {
        this.recording = false;
        this.recordedEdits = null;
        this.unexpandedRecordedEdits = null;
        this.recordEditsForUndo = false;
        this.lines = CollabBuffer.convertStringToLines(initialTextBuffer);
        const lineStartValues = new Uint32Array(this.lines.length);
        // Maps the buffer positions into lines to know what offset the line
        // started
        this.lines.forEach((line, index) => {
            lineStartValues[index] = line.length;
        });
        this.lineStarts = new prefixSumComputer_1.PrefixSumComputer(lineStartValues);
    }
    /**
     * Split a string into lines, taking \r\n, \n or \r as possible line terminators.
     */
    static convertStringToLines(source) {
        const len = source.length;
        let result = [];
        let currentLine = 0;
        let lineStartOffset = 0;
        let prevChCode = 0;
        // Walk the source character by character, searching for end of line to
        // capture a whole line.
        for (let i = 0; i < len; i++) {
            const chCode = source.charCodeAt(i);
            if (chCode === 10 /* \n */) {
                result[currentLine++] = source.substring(lineStartOffset, i + 1);
                lineStartOffset = i + 1;
            }
            else if (prevChCode === 13 /* \r */) {
                result[currentLine++] = source.substring(lineStartOffset, i);
                lineStartOffset = i;
            }
            prevChCode = chCode;
        }
        // Mop up the last line if it's not terminated by a new line itself
        result[currentLine++] = source.substring(lineStartOffset, len + 1);
        if (prevChCode === 13) {
            result[currentLine++] = '';
        }
        return result;
    }
    _validatePosition(position) {
        let { line, character } = position;
        // Clamp the lines to a valid range. We can't have negative lines, so
        // assume they really mean't the beginning of the buffer.
        if (line < 0) {
            line = 0;
            character = 0;
            return new CollabBufferPosition(line, character);
        }
        // If it was past or at the end, we want to bring it into the last valid
        // position in the buffer
        if (line >= this.lines.length) {
            line = this.lines.length - 1;
            character = this.lines[line].length;
            return new CollabBufferPosition(line, character);
        }
        // Constrain the character to no earlier than the beginning of the line
        let maxCharacter = this.lines[line].length;
        if (character < 0) {
            character = 0;
            return new CollabBufferPosition(line, character);
        }
        // Make sure it's not off the end of the buffer either
        if (character > maxCharacter) {
            character = maxCharacter;
            return new CollabBufferPosition(line, character);
        }
        // We were clearly within some valid range, so just return it
        return position;
    }
    /**
     * Convert (ln,ch) to a character offset from the begining of the raw string
     */
    offsetAt(position) {
        position = this._validatePosition(position);
        return this.lineStarts.getAccumulatedValue(position.line - 1) + position.character;
    }
    /**
     * Convert offset to a line & character number
     */
    positionAt(offset) {
        offset = Math.floor(offset);
        offset = Math.max(0, offset);
        const out = this.lineStarts.getIndexOf(offset);
        const lineMaxChar = this.lines[out.index].length;
        // Ensure we return a valid position
        return new CollabBufferPosition(out.index, Math.min(out.remainder, lineMaxChar));
    }
    /**
     * Get the content of the buffer.
     */
    getContent() {
        return this.lines.join('');
    }
    /**
     * Get the content of a line (including EOL)
     */
    getLineContent(line) {
        coeditingUtils_1.assert(line < this.lines.length, 'Line content requested outside of buffer');
        return this.lines[line];
    }
    /**
     * Get the maximum legal offset for the buffer.
     */
    getMaximumOffset() {
        return this.lineStarts.getAccumulatedValue(this.lines.length);
    }
    startCapturingEditsFromUndoing() {
        this.recordEditsForUndo = true;
        this.recordedUndoEdits = [];
    }
    stopCapturingEditsFromUndoing() {
        this.recordEditsForUndo = false;
        let backEdits = this.recordedUndoEdits;
        this.recordedUndoEdits = null;
        return backEdits;
    }
    /**
     * Begin recording changes applied to the buffer.
     * To be used in conjuction with `endRecording` to extract a single set of
     * edits that were applied to the buffer in the intervening period.
     */
    beginRecording() {
        this.recording = true;
        this.recordedEdits = null;
        this.unexpandedRecordedEdits = null;
    }
    /**
     * End recording changes applied to the buffer.
     * Returns the effects of all edits applied to the buffer as a single set (i.e. merged).
     */
    endRecording() {
        const r = this.recordedEdits;
        const ur = this.unexpandedRecordedEdits;
        this.recordedEdits = null;
        this.unexpandedRecordedEdits = null;
        this.recording = false;
        return [r, ur];
    }
    /**
     * Apply a single (ln,ch) edit
     */
    applyLocalEdit(start, end, text) {
        start = this._validatePosition(start);
        end = this._validatePosition(end);
        const startOffset = this.offsetAt(start);
        const endOffset = this.offsetAt(end);
        const oldText = this._getContentInRange(start, end);
        const edit = new InternalEdit(startOffset, endOffset - startOffset, start, end, oldText, text);
        this._applyInternalEdits([edit]);
    }
    /**
     * Apply N (offset,len) edits based on the current buffer state.
     */
    applyRemoteEdits(editsToApply) {
        let offsetEdits = editsToApply.map((edit, index) => {
            return new InternalOffsetEdit(index, edit.position, edit.length, edit.text);
        });
        // Sort edits ascending by offset and also check that:
        //  - they are within buffer bounds
        //  - they are not overlapping
        offsetEdits = CollabBuffer._sortAndValidateEdits(this.getMaximumOffset(), offsetEdits);
        // Merge adjacent (touching) edits
        offsetEdits = CollabBuffer._mergeAdjacentEdits(offsetEdits);
        let realizedEdits = offsetEdits.map((edit) => {
            const startPosition = this.positionAt(edit.offset);
            const endPosition = this.positionAt(edit.offset + edit.length);
            const oldText = this._getContentInRange(startPosition, endPosition);
            return new InternalEdit(edit.offset, edit.length, startPosition, endPosition, oldText, edit.text);
        });
        return this._applyInternalEdits(realizedEdits);
    }
    static _sortAndValidateEdits(maxPosition, edits) {
        if (util_1.checkDebugging()) {
            // Validate that edits are within bounds
            edits.forEach((edit) => {
                coeditingUtils_1.assert(edit.offset >= 0, 'invalid position');
                coeditingUtils_1.assert(edit.offset <= maxPosition, 'invalid position');
                coeditingUtils_1.assert(edit.length >= 0, 'invalid length');
                coeditingUtils_1.assert(edit.offset + edit.length <= maxPosition, 'invalid length');
            });
        }
        // Sort edits
        edits.sort(CollabBuffer._compareEdits);
        if (util_1.checkDebugging()) {
            // Check that there are no overlapping edits.
            edits.forEach((currentEdit, index, source) => {
                // Can't compare a previous item if there is infact no previous item
                if (index === 0) {
                    return;
                }
                const previousEdit = source[index - 1];
                if (previousEdit.offset + previousEdit.length > currentEdit.offset) {
                    coeditingUtils_1.assert(false, 'invalid edits: overlapping');
                }
            });
        }
        return edits;
    }
    static _compareEdits(a, b) {
        const posDelta = a.offset - b.offset;
        if (posDelta === 0) {
            return a.index - b.index;
        }
        return posDelta;
    }
    static _mergeAdjacentEdits(edits) {
        if (edits.length <= 1) {
            return edits;
        }
        let result = [];
        let resultLen = 0;
        let previousEdit = edits[0];
        for (let i = 1, len = edits.length; i < len; i++) {
            const currentEdit = edits[i];
            if ((previousEdit.offset + previousEdit.length) === currentEdit.offset) {
                // Accumulate adjacent edits into one, larger edit. Note, that
                // this will keep going until it finds a break
                previousEdit = new InternalOffsetEdit(previousEdit.index, previousEdit.offset, previousEdit.length + currentEdit.length, previousEdit.text + currentEdit.text);
                continue;
            }
            // Non adjacent edit, start a new edit.
            result[resultLen++] = previousEdit;
            previousEdit = currentEdit;
        }
        result[resultLen++] = previousEdit;
        return result;
    }
    _getContentInRange(start, end) {
        // It's on the same line, we can just service from the specific line directly
        if (start.line === end.line) {
            return this.lines[start.line].substring(start.character, end.character);
        }
        let result = [];
        let resultLen = 0;
        // Approach this by accumulating the start &  tails as the substrings
        // and copy the "middle" wholesale (since it's just hole lines)
        result[resultLen++] = this.lines[start.line].substr(start.character);
        for (let i = start.line + 1; i < end.line; i++) {
            result[resultLen++] = this.lines[i];
        }
        result[resultLen++] = this.lines[end.line].substr(0, end.character);
        return result.join('');
    }
    _expandCRLFEdits(edits) {
        let result = [];
        let resultLen = 0;
        for (let i = 0, len = edits.length; i < len; i++) {
            const edit = edits[i];
            let offset = edit.offset;
            let length = edit.length;
            let startPosition = edit.start;
            let endPosition = edit.end;
            let oldText = edit.oldText;
            let newText = edit.newText;
            if (offset > 0) {
                let beforePosition;
                let lineText;
                if (startPosition.character === 0) {
                    lineText = this.lines[startPosition.line - 1];
                    beforePosition = new CollabBufferPosition(startPosition.line - 1, lineText.length - 1);
                }
                else {
                    lineText = this.lines[startPosition.line];
                    beforePosition = new CollabBufferPosition(startPosition.line, startPosition.character - 1);
                }
                if (lineText.charCodeAt(beforePosition.character) === 13 /* \r */) {
                    // include the replacement of \r in the edit
                    offset--;
                    length++;
                    newText = '\r' + newText;
                    oldText = '\r' + oldText;
                    startPosition = beforePosition;
                }
            }
            const endLineText = this.lines[endPosition.line];
            if (endPosition.character < endLineText.length && endLineText.charCodeAt(endPosition.character) === 10 /* \n */) {
                // include the replacement of \n in the edit
                length++;
                newText = newText + '\n';
                oldText = oldText + '\n';
                endPosition = new CollabBufferPosition(endPosition.line + 1, 0);
            }
            result[resultLen++] = new InternalEdit(offset, length, startPosition, endPosition, oldText, newText);
        }
        return result;
    }
    _applyInternalEdits(edits) {
        // Handle CRLF special cases by expanding the edits around CR or LF
        const expandedEdits = this._expandCRLFEdits(edits);
        // Create changes and (ln;ch) edits
        let changes = new Array(expandedEdits.length);
        let unexpandedChanges = new Array(expandedEdits.length);
        let expandedDeltaOffset = 0;
        let unexpandedDeltaOffset = 0;
        for (let i = 0; i < expandedEdits.length; i++) {
            const edit = edits[i];
            const expandedEdit = expandedEdits[i];
            changes[i] = new textChange_1.TextChange(expandedEdit.offset, expandedEdit.oldText, expandedEdit.offset + expandedDeltaOffset, expandedEdit.newText);
            unexpandedChanges[i] = new textChange_1.TextChange(edit.offset, edit.oldText, edit.offset + unexpandedDeltaOffset, edit.newText);
            expandedDeltaOffset += expandedEdit.newText.length - expandedEdit.length;
            unexpandedDeltaOffset += edit.newText.length - edit.length;
        }
        for (let i = expandedEdits.length - 1; i >= 0; i--) {
            const edit = expandedEdits[i];
            this._delete(edit.start, edit.end);
            this._insert(edit.start, edit.newText);
        }
        if (this.recording) {
            this.recordedEdits = textChange_1.compressConsecutiveTextChanges(this.recordedEdits, changes);
            this.unexpandedRecordedEdits = textChange_1.compressConsecutiveTextChanges(this.unexpandedRecordedEdits, unexpandedChanges);
        }
        if (this.recordEditsForUndo) {
            this.recordedUndoEdits = textChange_1.compressConsecutiveTextChanges(this.recordedUndoEdits, changes);
        }
        return changes;
    }
    _setLineText(line, newValue) {
        this.lines[line] = newValue;
        this.lineStarts.changeValue(line, newValue.length);
    }
    _delete(start, end) {
        if (start.line === end.line) {
            if (start.character === end.character) {
                // Nothing to delete
                return;
            }
            // Delete text on the affected line
            let lineText = this.lines[start.line];
            this._setLineText(start.line, lineText.substring(0, start.character) + lineText.substring(end.character));
            return;
        }
        // Take remaining text on last line and append it to remaining text on first line
        let firstLineText = this.lines[start.line];
        let lastLineText = this.lines[end.line];
        this._setLineText(start.line, firstLineText.substring(0, start.character) + lastLineText.substring(end.character));
        // Delete middle lines
        this.lines.splice(start.line + 1, end.line - start.line);
        this.lineStarts.removeValues(start.line + 1, end.line - start.line);
    }
    _insert(position, insertText) {
        if (insertText.length === 0) {
            // Nothing to insert
            return;
        }
        let insertLines = CollabBuffer.convertStringToLines(insertText);
        if (insertLines.length === 1) {
            // Inserting text on one line
            let lineText = this.lines[position.line];
            this._setLineText(position.line, lineText.substring(0, position.character)
                + insertLines[0]
                + lineText.substring(position.character));
            return;
        }
        // Append overflowing text from first line to the end of text to insert
        insertLines[insertLines.length - 1] += this.lines[position.line].substring(position.character);
        // Delete overflowing text from first line and insert text on first line
        this._setLineText(position.line, this.lines[position.line].substring(0, position.character) + insertLines[0]);
        // Remove first element that was already handled
        insertLines.shift();
        // Insert new lines & store lengths
        let newLengths = new Uint32Array(insertLines.length);
        for (let i = 0; i < insertLines.length; i++) {
            newLengths[i] = insertLines[i].length;
        }
        this.lines = insertIntoNewArray(this.lines, position.line + 1, insertLines);
        this.lineStarts.insertValues(position.line + 1, newLengths);
    }
}
exports.CollabBuffer = CollabBuffer;

//# sourceMappingURL=collabBuffer.js.map
