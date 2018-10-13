"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StringFunctions_1 = require("./tools/StringFunctions");
const ArrayFunctions_1 = require("./tools/ArrayFunctions");
class Options {
    //private Settings m_settings = Settings.Default;
    constructor() {
        this.Reload();
    }
    Reload() {
        //this.Shortcuts               = KeyShortcut.Get(m_settings.Shortcuts).ToList();
        //this.XmlTypes                = m_settings.XmlTypes.Cast<string>().ToArray();
        this.ScopeSelectorLineValues = " { } }; ( )"; //m_settings.ScopeSelectorLineValues;
        this.ScopeSelectorLineEnds = ""; //m_settings.ScopeSelectorLineEnds;
        //this.UseIdeTabSettings       = m_settings.UseIdeTabSettings;
    }
    get ScopeSelectorRegex() {
        var values = this.ToOrRegex(this.ScopeSelectorLineValues, "^\\s*({0}|)\\s*$");
        var ends = this.ToOrRegex(this.ScopeSelectorLineEnds, "({0})\\s*$");
        return ends == null ? values : `(${values}|${ends})`;
    }
    ToOrRegex(input, format) {
        var items = input.split(" ") //, StringSplitOptions.RemoveEmptyEntries)
            .filter(x => x.trim() != "")
            .map(x => StringFunctions_1.StringFunctions.RegexEscape(x));
        var str = ArrayFunctions_1.ArrayFunctions.Aggregate(items, "|");
        return items.length > 0 ? format.replace("{0}", str) : null;
    }
    get XmlTypesString() {
        return ArrayFunctions_1.ArrayFunctions.Aggregate(this.XmlTypes, "\r\n");
    }
    set XmlTypesString(value) {
        this.XmlTypes = value.split('\n')
            .map(x => x.trim().toLowerCase());
    }
    GetShortcut(key, language = null) {
        var shortcuts = this.Shortcuts.filter(x => x.Value == key
            && (x.Language == null || x.Language == language));
        if (shortcuts.length === 0)
            return null;
        return shortcuts.sort(x => x.Language === language ? 1 : 0)[0];
    }
    ResetShortcuts() {
        //this.Shortcuts =
    }
    ResetSelectorTypes() {
        //TODO: Load default values
        //this.XmlTypes                =
        //this.ScopeSelectorLineValues =
        //this.ScopeSelectorLineEnds   =
    }
    Save() {
        //TODO: Save data
    }
    SaveAs(filename) {
        //TODO: Save data
    }
    LoadFrom(filename) {
        //TODO: Load data
        this.Reload();
    }
}
exports.Options = Options;
//# sourceMappingURL=Options.js.map