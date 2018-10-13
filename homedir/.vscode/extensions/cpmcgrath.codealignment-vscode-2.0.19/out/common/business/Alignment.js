"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const NormalDelimiterFinder_1 = require("./delimiterFinders/NormalDelimiterFinder");
const lineDetails_1 = require("./lineDetails");
const StringFunctions_1 = require("./tools/StringFunctions");
const ArrayFunctions_1 = require("./tools/ArrayFunctions");
class Alignment {
    constructor() {
        this.Finder = new NormalDelimiterFinder_1.NormalDelimiterFinder();
    }
    PerformAlignment(delimiter, minIndex = 0, addSpace = false) {
        var lines = this.Selector.GetLinesToAlign(this.View);
        var data = lines.map(x => new lineDetails_1.LineDetails(x, this.Finder, delimiter, minIndex, this.View.TabSize))
            .filter(y => y.Index >= 0);
        if (data.length <= 0)
            return -1;
        var maxItems = ArrayFunctions_1.ArrayFunctions.MaxItemsBy(data, y => y.Position);
        var targetPosition = ArrayFunctions_1.ArrayFunctions.Max(maxItems, x => x.GetPositionToAlignTo(addSpace, this.View.TabSize));
        this.CommitChanges(data, targetPosition);
        return targetPosition;
    }
    CommitChanges(data, targetPosition) {
        var edit = this.View.StartEdit();
        try {
            for (let change of data) {
                var spaces = this.GetSpacesToInsert(change.Position, targetPosition);
                if (!edit.Insert(change.Line, change.Index, spaces))
                    return;
            }
            edit.Commit();
        }
        finally {
            edit.Dispose();
        }
    }
    GetSpacesToInsert(startIndex, endIndex) {
        var useSpaces = this.View.ConvertTabsToSpaces;
        if (useSpaces || !this.UseIdeTabSettings)
            return StringFunctions_1.StringFunctions.GetSpaces(endIndex - startIndex);
        var spaces = endIndex % this.View.TabSize;
        var tabs = Math.ceil((endIndex - spaces - startIndex) / this.View.TabSize);
        return (tabs == 0) ? StringFunctions_1.StringFunctions.GetSpaces(endIndex - startIndex)
            : StringFunctions_1.StringFunctions.GetSpaces(tabs, '\t') + StringFunctions_1.StringFunctions.GetSpaces(spaces);
    }
}
exports.Alignment = Alignment;
//# sourceMappingURL=Alignment.js.map