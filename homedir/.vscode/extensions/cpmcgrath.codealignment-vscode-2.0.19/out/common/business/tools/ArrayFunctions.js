"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ArrayFunctions {
    static MaxItemsBy(source, callbackfn) {
        var maxVal = -1;
        var items = [];
        for (let item of source) {
            var result = callbackfn(item);
            if (result > maxVal) {
                maxVal = result;
                items = [];
            }
            if (result === maxVal)
                items.push(item);
        }
        return items;
    }
    static Max(source, callbackfn) {
        var maxVal = -1;
        for (let item of source) {
            var result = callbackfn(item);
            if (result > maxVal)
                maxVal = result;
        }
        return maxVal;
    }
    static Aggregate(instance, join) {
        var isEmpty = true;
        var result = "";
        for (let item of instance) {
            if (isEmpty)
                isEmpty = false;
            else
                result += join;
            result += item;
        }
        return result;
    }
}
exports.ArrayFunctions = ArrayFunctions;
//# sourceMappingURL=ArrayFunctions.js.map