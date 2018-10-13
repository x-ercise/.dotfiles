"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Edit {
    constructor(editor) {
        this.m_editor = editor;
        this.m_changes = [];
    }
    Insert(line, position, text) {
        var pos = this.m_editor.document.positionAt(line.Position + position);
        this.m_changes.push({ position: pos, text: text });
        return true;
    }
    Commit() {
        this.m_editor.edit(x => {
            while (this.m_changes.length > 0) {
                var item = this.m_changes.pop();
                x.insert(item.position, item.text);
            }
        });
    }
    Dispose() {
    }
}
exports.Edit = Edit;
//# sourceMappingURL=edit.js.map