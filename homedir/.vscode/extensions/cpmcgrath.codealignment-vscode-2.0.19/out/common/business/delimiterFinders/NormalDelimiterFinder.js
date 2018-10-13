"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DelimiterResult_1 = require("./DelimiterResult");
class NormalDelimiterFinder {
    //virtual
    GetIndex(source, delimiter, minIndex, tabSize) {
        minIndex = this.TabbifyIndex(source, minIndex, tabSize);
        var result = source.length >= minIndex ? source.indexOf(delimiter, minIndex) : -1;
        return DelimiterResult_1.DelimiterResult.Create(result);
    }
    TabbifyIndex(source, minIndex, tabSize) {
        var adjustment = 0;
        var index = source.indexOf('\t');
        while (index >= 0 && index < minIndex) {
            var padding = tabSize - ((index + adjustment) % tabSize);
            if (index + padding - 1 <= minIndex)
                adjustment += padding - 1;
            index = source.indexOf('\t', index + 1);
        }
        return minIndex - adjustment;
    }
}
exports.NormalDelimiterFinder = NormalDelimiterFinder;
//# sourceMappingURL=NormalDelimiterFinder.js.map