"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Line {
    constructor(doc, line) {
        this.m_doc = doc;
        this.m_line = line;
    }
    get Position() {
        return this.m_doc.offsetAt(this.m_line.range.start);
    }
    get Text() {
        return this.m_line.text;
    }
}
exports.Line = Line;
//# sourceMappingURL=line.js.map