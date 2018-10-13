"use strict";
// import
Object.defineProperty(exports, "__esModule", { value: true });
class DocFormater {
    static format(doc, useJsDoc) {
        if (!doc)
            return;
        if (useJsDoc)
            return this.formatToMarkdown(doc);
        else
            return this.formatToText(doc);
    }
    static formatToText(doc) {
        // remove /** */ and * at begin of line
        const regExpFormat = /\*\/|\/\*\*?|^[\t ]*\*[\t \/]?/gim;
        return doc.replace(regExpFormat, '').trim().replace(/^\s+$/gmi, '');
    }
    static formatToMarkdown(doc) {
        doc = this.formatToText(doc);
        const regExpFormat = /([\r\n])?(@param|@return|@\w+)[\t ]*:?[\t ]*({[\w%$#]+})?[\t ]*(\w*)[\t ]*(\w*)/gi;
        return doc.replace(regExpFormat, (match, br, name, type, desc1, desc2) => {
            let result = `_${name}_ `;
            if (br)
                result = '\n\n' + result; //double \n to force new line
            if (type)
                result += ` **${type}**`;
            if (name && name.toLowerCase() === '@param') {
                if (desc1) // param name
                    result += ` \`${desc1}\``;
                if (desc2)
                    result += ` - ${desc2}`;
            }
            else {
                if (desc1)
                    result += ` - ${desc1}`;
                if (desc2)
                    result += ` ${desc2}`;
            }
            return result;
        });
    }
}
exports.default = DocFormater;
//# sourceMappingURL=docFormater.js.map