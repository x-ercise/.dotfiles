"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class GeneralScopeSelector {
    GetLinesToAlign(view) {
        var start = this.Start || view.StartSelectionLineNumber;
        var end = this.End || view.EndSelectionLineNumber;
        if (start == end) {
            start = this.GetStart(view, start);
            end = this.GetEnd(view, end);
        }
        var result = [];
        for (var i = start; i <= end; i++)
            result.push(view.GetLineFromLineNumber(i));
        return result;
    }
    GetStart(view, start) {
        for (var i = start; i >= 0; i--)
            if (this.IsLineBlank(view, i))
                return i + 1;
        return 0;
    }
    GetEnd(view, end) {
        for (var i = end; i < view.LineCount; i++)
            if (this.IsLineBlank(view, i))
                return i - 1;
        return view.LineCount - 1;
    }
    IsLineBlank(view, lineNo) {
        //return Regex.IsMatch(view.GetLineFromLineNumber(lineNo).Text, this.ScopeSelectorRegex);
        var line = view.GetLineFromLineNumber(lineNo);
        return line.Text.match(this.ScopeSelectorRegex) !== null;
    }
}
exports.GeneralScopeSelector = GeneralScopeSelector;
//# sourceMappingURL=GeneralScopeSelector.js.map