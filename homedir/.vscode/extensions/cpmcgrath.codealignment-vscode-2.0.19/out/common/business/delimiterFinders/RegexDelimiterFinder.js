"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const NormalDelimiterFinder_1 = require("./NormalDelimiterFinder");
const DelimiterResult_1 = require("./DelimiterResult");
class RegexDelimiterFinder extends NormalDelimiterFinder_1.NormalDelimiterFinder {
    //override
    GetIndex(source, delimiter, minIndex, tabSize) {
        minIndex = this.TabbifyIndex(source, minIndex, tabSize);
        if (source.length < minIndex) {
            return DelimiterResult_1.DelimiterResult.Create(-1);
        }
        //var match = Regex.Match(source.substring(minIndex), delimiter);
        var match = source.substring(minIndex).match(delimiter);
        if (match === null) {
            return DelimiterResult_1.DelimiterResult.Create(-1);
        }
        var result = new DelimiterResult_1.DelimiterResult();
        result.CompareIndex = minIndex + this.GetGroupIndex(match, "compare", "x");
        result.InsertIndex = minIndex + this.GetGroupIndex(match, "insert", "compare", "x");
        return result;
    }
    GetGroupIndex(match, ...keys) {
        //TODO: Groups
        //for (var key in keys)
        //{
        //    var group = match.Groups[key];
        //    if (group.Success)
        //        return group.Index;
        //}
        return match.index;
    }
}
exports.RegexDelimiterFinder = RegexDelimiterFinder;
//# sourceMappingURL=RegexDelimiterFinder.js.map