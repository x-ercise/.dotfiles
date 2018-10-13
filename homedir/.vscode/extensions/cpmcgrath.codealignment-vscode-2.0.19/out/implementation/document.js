"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const line_1 = require("./line");
const edit_1 = require("./edit");
class Document {
    constructor(editor) {
        this.m_editor = editor;
    }
    get LineCount() {
        return this.m_editor.document.lineCount;
    }
    get StartSelectionLineNumber() {
        return Math.min(...this.m_editor.selections.map(x => x.start.line));
    }
    get EndSelectionLineNumber() {
        return Math.max(...this.m_editor.selections.map(x => x.end.line));
    }
    get CaretColumn() {
        var caret = this.m_editor.selection.active;
        return this.m_editor.document.lineAt(caret.line).range.start.compareTo(caret);
    }
    get ConvertTabsToSpaces() {
        return true;
    }
    get TabSize() {
        return this.m_editor.options.tabSize;
    }
    get FileType() {
        return ".cs";
    }
    GetLineFromLineNumber(lineNo) {
        return new line_1.Line(this.m_editor.document, this.m_editor.document.lineAt(lineNo));
    }
    StartEdit() {
        return new edit_1.Edit(this.m_editor);
    }
    Refresh() {
    }
}
exports.Document = Document;
//# sourceMappingURL=document.js.map