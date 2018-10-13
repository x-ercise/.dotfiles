"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StringFunctions_1 = require("./tools/StringFunctions");
class LineDetails {
    constructor(line, finder, delimiter, minIndex, tabSize) {
        var withoutTabs = StringFunctions_1.StringFunctions.ReplaceTabs(line.Text, tabSize);
        this.Line = line;
        this.Index = finder.GetIndex(line.Text, delimiter, minIndex, tabSize).InsertIndex;
        this.Position = finder.GetIndex(withoutTabs, delimiter, minIndex, tabSize).CompareIndex;
    }
    GetPositionToAlignTo(addSpace, tabSize) {
        if (addSpace && this.Position > 0
            && StringFunctions_1.StringFunctions.ReplaceTabs(this.Line.Text, tabSize)[this.Position - 1] != ' ')
            return this.Position + 1;
        return this.Position;
    }
}
exports.LineDetails = LineDetails;
//# sourceMappingURL=lineDetails.js.map