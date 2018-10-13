"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StringFunctions_1 = require("../tools/StringFunctions");
class XmlScopeSelector {
    GetLinesToAlign(view) {
        var start = this.Start || view.StartSelectionLineNumber;
        var end = this.End || view.EndSelectionLineNumber;
        if (start == end) {
            var line = StringFunctions_1.StringFunctions.ReplaceTabs(view.GetLineFromLineNumber(start).Text, view.TabSize);
            var isMulti = this.IsMultiLineTag(view, line);
            start = this.GetStart(view, start, line, isMulti);
            end = this.GetStart(view, end, line, isMulti);
        }
        var result = [];
        for (var i = start; i <= end; i++)
            result.push(view.GetLineFromLineNumber(i));
        return result;
    }
    GetStart(view, start, line, isMulti) {
        if (isMulti)
            for (var i = start; i >= 0; i--) {
                if (this.IsMultiLineStart(view, i))
                    return i;
            }
        else
            for (var i = start + 1; i >= 1; i--) {
                if (this.IsNotSameScope(view, i - 1, line))
                    return i;
            }
        return 0;
    }
    GetEnd(view, end, line, isMulti) {
        if (isMulti)
            for (var i = end; i < view.LineCount; i++) {
                if (this.IsMultiLineStart(view, i))
                    return i + 1;
            }
        else
            for (var i = end - 1; i < view.LineCount - 1; i++) {
                if (this.IsNotSameScope(view, i + 1, line))
                    return i + 1;
            }
        return 0;
    }
    IsMultiLineTag(view, line) {
        line = line.trim();
        return line === "" || line[0] !== "<" || line.indexOf(">") < 0;
    }
    IsMultiLineStart(view, lineNo) {
        var line = view.GetLineFromLineNumber(lineNo).Text.trim();
        return line === "" || line[0] === "<";
    }
    IsMultiLineEnd(view, lineNo) {
        var line = view.GetLineFromLineNumber(lineNo).Text.trim();
        return line == "" || line.indexOf(">") >= 0;
    }
    IsNotSameScope(view, lineNo, original) {
        var line = StringFunctions_1.StringFunctions.ReplaceTabs(view.GetLineFromLineNumber(lineNo).Text, view.TabSize);
        var lineIndent = StringFunctions_1.StringFunctions.SpacesAtStart(line);
        var originalIndent = StringFunctions_1.StringFunctions.SpacesAtStart(original);
        return line.trim() === "" || lineIndent != originalIndent;
    }
}
//# sourceMappingURL=XmlScopeSelector.js.map