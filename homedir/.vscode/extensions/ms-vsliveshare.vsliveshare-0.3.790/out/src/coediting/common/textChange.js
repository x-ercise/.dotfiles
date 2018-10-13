"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
const coeditingUtils_1 = require("./coeditingUtils");
class TextChange {
    constructor(oldPosition, oldText, newPosition, newText) {
        this.oldPosition = oldPosition;
        this.oldLength = oldText.length;
        this.oldEnd = this.oldPosition + this.oldLength;
        this.oldText = oldText;
        this.newPosition = newPosition;
        this.newLength = newText.length;
        this.newEnd = this.newPosition + this.newLength;
        this.newText = newText;
    }
}
exports.TextChange = TextChange;
function compressConsecutiveTextChanges(prevEdits, currEdits) {
    if (prevEdits === null) {
        return currEdits;
    }
    let compressor = new TextChangeCompressor();
    return compressor.compress(prevEdits, currEdits);
}
exports.compressConsecutiveTextChanges = compressConsecutiveTextChanges;
class TextChangeCompressor {
    constructor() {
    }
    static _rebaseCurr(prevDeltaOffset, currEdit) {
        return new TextChange(currEdit.oldPosition - prevDeltaOffset, currEdit.oldText, currEdit.newPosition, currEdit.newText);
    }
    static _rebasePrev(currDeltaOffset, prevEdit) {
        return new TextChange(prevEdit.oldPosition, prevEdit.oldText, prevEdit.newPosition + currDeltaOffset, prevEdit.newText);
    }
    compress(previousEdits, currentEdits) {
        this.prevEdits = previousEdits;
        this.currEdits = currentEdits;
        this.result = [];
        this.resultLen = 0;
        let prevIndex = 0;
        this.prevLen = this.prevEdits.length;
        this.prevDeltaOffset = 0;
        let currIndex = 0;
        this.currLen = this.currEdits.length;
        this.currDeltaOffset = 0;
        let prevEdit = this._getPrev(prevIndex);
        let currEdit = this._getCurr(currIndex);
        while (prevIndex < this.prevLen || currIndex < this.currLen) {
            if (prevEdit === null) {
                this._acceptCurr(currEdit);
                currEdit = this._getCurr(++currIndex);
                continue;
            }
            if (currEdit === null) {
                this._acceptPrev(prevEdit);
                prevEdit = this._getPrev(++prevIndex);
                continue;
            }
            if (currEdit.oldEnd <= prevEdit.newPosition) {
                this._acceptCurr(currEdit);
                currEdit = this._getCurr(++currIndex);
                continue;
            }
            if (prevEdit.newEnd <= currEdit.oldPosition) {
                this._acceptPrev(prevEdit);
                prevEdit = this._getPrev(++prevIndex);
                continue;
            }
            if (currEdit.oldPosition < prevEdit.newPosition) {
                let [e1, e2] = TextChangeCompressor._splitCurr(currEdit, prevEdit.newPosition - currEdit.oldPosition);
                this._acceptCurr(e1);
                currEdit = e2;
                continue;
            }
            if (prevEdit.newPosition < currEdit.oldPosition) {
                let [e1, e2] = TextChangeCompressor._splitPrev(prevEdit, currEdit.oldPosition - prevEdit.newPosition);
                this._acceptPrev(e1);
                prevEdit = e2;
                continue;
            }
            coeditingUtils_1.assert(currEdit.oldPosition === prevEdit.newPosition, 'unexpected');
            let mergePrev;
            let mergeCurr;
            if (currEdit.oldEnd === prevEdit.newEnd) {
                mergePrev = prevEdit;
                mergeCurr = currEdit;
                prevEdit = this._getPrev(++prevIndex);
                currEdit = this._getCurr(++currIndex);
            }
            else if (currEdit.oldEnd < prevEdit.newEnd) {
                let [e1, e2] = TextChangeCompressor._splitPrev(prevEdit, currEdit.oldLength);
                mergePrev = e1;
                mergeCurr = currEdit;
                prevEdit = e2;
                currEdit = this._getCurr(++currIndex);
            }
            else {
                let [e1, e2] = TextChangeCompressor._splitCurr(currEdit, prevEdit.newLength);
                mergePrev = prevEdit;
                mergeCurr = e1;
                prevEdit = this._getPrev(++prevIndex);
                currEdit = e2;
            }
            this.result[this.resultLen++] = new TextChange(mergePrev.oldPosition, mergePrev.oldText, mergeCurr.newPosition, mergeCurr.newText);
            this.prevDeltaOffset += mergePrev.newLength - mergePrev.oldLength;
            this.currDeltaOffset += mergeCurr.newLength - mergeCurr.oldLength;
        }
        let merged = TextChangeCompressor._merge(this.result);
        let cleaned = TextChangeCompressor._removeNoOps(merged);
        return cleaned;
    }
    _acceptCurr(currEdit) {
        this.result[this.resultLen++] = TextChangeCompressor._rebaseCurr(this.prevDeltaOffset, currEdit);
        this.currDeltaOffset += currEdit.newLength - currEdit.oldLength;
    }
    _getCurr(currIndex) {
        return (currIndex < this.currLen ? this.currEdits[currIndex] : null);
    }
    _acceptPrev(prevEdit) {
        this.result[this.resultLen++] = TextChangeCompressor._rebasePrev(this.currDeltaOffset, prevEdit);
        this.prevDeltaOffset += prevEdit.newLength - prevEdit.oldLength;
    }
    _getPrev(prevIndex) {
        return (prevIndex < this.prevLen ? this.prevEdits[prevIndex] : null);
    }
    static _splitPrev(edit, offset) {
        let preText = edit.newText.substr(0, offset);
        let postText = edit.newText.substr(offset);
        return [
            new TextChange(edit.oldPosition, edit.oldText, edit.newPosition, preText),
            new TextChange(edit.oldEnd, '', edit.newPosition + offset, postText)
        ];
    }
    static _splitCurr(edit, offset) {
        let preText = edit.oldText.substr(0, offset);
        let postText = edit.oldText.substr(offset);
        return [
            new TextChange(edit.oldPosition, preText, edit.newPosition, edit.newText),
            new TextChange(edit.oldPosition + offset, postText, edit.newEnd, '')
        ];
    }
    static _merge(edits) {
        if (edits.length === 0) {
            return edits;
        }
        let result = [], resultLen = 0;
        let prev = edits[0];
        for (let i = 1; i < edits.length; i++) {
            let curr = edits[i];
            if (prev.oldEnd === curr.oldPosition) {
                // Merge into `prev`
                prev = new TextChange(prev.oldPosition, prev.oldText + curr.oldText, prev.newPosition, prev.newText + curr.newText);
            }
            else {
                result[resultLen++] = prev;
                prev = curr;
            }
        }
        result[resultLen++] = prev;
        return result;
    }
    static _removeNoOps(edits) {
        if (edits.length === 0) {
            return edits;
        }
        let result = [], resultLen = 0;
        for (let i = 0; i < edits.length; i++) {
            let edit = edits[i];
            if (edit.oldText === edit.newText) {
                continue;
            }
            result[resultLen++] = edit;
        }
        return result;
    }
}

//# sourceMappingURL=textChange.js.map
