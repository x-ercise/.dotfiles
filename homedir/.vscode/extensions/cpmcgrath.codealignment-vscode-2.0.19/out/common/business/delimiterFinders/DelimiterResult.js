"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DelimiterResult {
    static Create(index) {
        var result = new DelimiterResult();
        result.CompareIndex = index,
            result.InsertIndex = index;
        return result;
    }
}
exports.DelimiterResult = DelimiterResult;
//# sourceMappingURL=DelimiterResult.js.map