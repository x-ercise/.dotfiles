"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const json5 = require("json5");
const dateFormat = require("dateformat");
const plsql_settings_1 = require("./plsql.settings");
/**
 * Controller for handling PlDoc.
 */
class PLDocController {
    constructor() {
    }
    getDocSnippet(document, text) {
        this.init(document.uri);
        if (this.plDocEnable && this.plDocTemplate) {
            let plDocObj = this.getInfo(text);
            if (plDocObj)
                return this.buildTemplate(plDocObj, this.plDocTemplate);
        }
    }
    getCustomSnippets(document) {
        this.init(document.uri);
        return this.plDocSnippets;
    }
    init(file) {
        // TODO: different plDoc for different workspaceFolders ?
        if (this.plDocEnable == null) {
            const { enable, author, location } = plsql_settings_1.PLSQLSettings.getDocInfos(file);
            this.plDocEnable = enable;
            this.plDocAuthor = author;
            this.initTemplates(location);
        }
    }
    getRegFindVar() {
        return /\$(?:{)?(\d+)/gi;
    }
    getRegFindVarParam() {
        return new RegExp(`\\\${pldoc_${'param'}}`, 'i');
    }
    getRegFindVarParamType() {
        return new RegExp(`\\\${pldoc_${'param_type'}}`, 'i');
    }
    getRegFindVarDoc(key) {
        return new RegExp(`\\\${pldoc_(${key})(?:(?:\\s*\\|\\s*)([^}]*))?}`, 'i');
    }
    getRegFindReturn() {
        return /\breturn\b/i; // @return
    }
    getInfo(text) {
        let plDocObj;
        const regex = /(function|procedure)\s*(\w+)\s*(\([\s\S]*?\))?(?:\s*(return))?/i;
        let found = regex.exec(text);
        if (found && found.length > 0) {
            // Function or Procedure
            plDocObj = {
                type: found[1].toLowerCase(),
                name: found[2],
                params: []
            };
            // Params
            const params = found[3], regexParams = /(?:\(|,)\s*(\w+)\s*((?:in\s*out|in|out)?(?:\s*)?\w*)/g;
            if (params !== '') {
                while (found = regexParams.exec(params)) {
                    if (found.length > 0)
                        plDocObj.params.push({ name: found[1], dataType: found[2] });
                }
            }
        }
        return plDocObj;
    }
    initTemplates(location) {
        let parsedJSON;
        try {
            parsedJSON = json5.parse(fs.readFileSync(location).toString()); // invalid JSON or permission issue can happen here
        }
        catch (error) {
            console.error(error);
            return;
        }
        if (parsedJSON) {
            const variables = {
                author: this.plDocAuthor,
                date: new Date()
            };
            Object.keys(parsedJSON).forEach(key => {
                // Doc
                if (key === 'pldoc') {
                    if (this.plDocEnable && parsedJSON.pldoc.body) {
                        this.plDocTemplate = parsedJSON.pldoc;
                        this.addTemplateInfo(this.plDocTemplate);
                    }
                    else
                        this.plDocTemplate = null;
                }
                else { // Other custom snippet
                    const snippet = parsedJSON[key];
                    snippet.body.forEach((text, index) => snippet.body[index] = this.replaceText(variables, text));
                    if (!this.plDocSnippets)
                        this.plDocSnippets = [];
                    this.plDocSnippets.push(snippet);
                }
            });
        }
    }
    addTemplateInfo(template) {
        // Find index of params line
        const regFindParam = this.getRegFindVarParam(), regFindVar = this.getRegFindVar(), regFindReturn = this.getRegFindReturn();
        let found;
        template.body.forEach((text, index) => {
            if (template.paramIndex == null) {
                found = regFindParam.exec(text);
                if (found) {
                    template.paramIndex = index;
                    template.paramMaxVar = 0;
                    template.paramVarCount = 0;
                    let foundVar, numberVar = 0;
                    while (foundVar = regFindVar.exec(text)) {
                        ++template.paramVarCount;
                        numberVar = Number(foundVar[1]);
                        if (template.paramMaxVar < numberVar)
                            template.paramMaxVar = numberVar;
                    }
                }
            }
            if (template.returnIndex == null) {
                found = regFindReturn.exec(text);
                if (found)
                    template.returnIndex = index;
            }
        });
    }
    buildTemplate(plDocObj, template) {
        let body = [];
        const variables = {
            regFindVar: this.getRegFindVar(),
            values: {
                type: plDocObj.type,
                object: plDocObj.name,
                author: this.plDocAuthor,
                date: new Date()
            },
            shift: plDocObj.params.length > 1 ? (plDocObj.params.length - 1) * template.paramVarCount : 0,
            offset: template.paramMaxVar
        };
        template.body.forEach((text, index) => {
            let lineText = text;
            if (index !== template.paramIndex) {
                if (index !== template.returnIndex || plDocObj.type === 'function') {
                    lineText = this.replaceText(variables.values, lineText);
                    lineText = this.shiftVariables(variables, lineText, template);
                    body.push(lineText);
                }
            }
            else {
                plDocObj.params.forEach((param, paramIndex) => {
                    let paramText = lineText;
                    paramText = this.replaceTextParam(param, paramText);
                    if (paramIndex > 0)
                        paramText = this.shiftParamVariables(variables, paramText);
                    body.push(paramText);
                });
            }
        });
        if (body.length > 0)
            return {
                prefix: template.prefix,
                body: body,
                description: template.description
            };
    }
    replaceText(variables, text) {
        // replace special variables values
        Object.keys(variables).forEach(key => {
            text = text.replace(this.getRegFindVarDoc(key), (match, p1, p2) => {
                if (!p1 || (p1.toLowerCase() !== 'date'))
                    return variables[key];
                else {
                    // replace date
                    if (!p2 || (p2.trim() === ''))
                        return variables.date.toLocaleDateString();
                    else
                        return dateFormat(variables.date, p2);
                }
            });
        });
        return text;
    }
    shiftVariables(variables, text, template) {
        if (variables.shift > 0) {
            text = text.replace(variables.regFindVar, (match, p1) => {
                if (Number(p1) > template.paramMaxVar) {
                    // Shift variables $n or ${n:xxx}
                    if (match.startsWith('${'))
                        return '${' + String(variables.shift + Number(p1));
                    else //if (match.startsWith('$'))
                        return '$' + String(variables.shift + Number(p1));
                }
                else
                    return match;
            });
        }
        return text;
    }
    replaceTextParam(param, text) {
        // replace special variables values
        return text.replace(this.getRegFindVarParam(), param.name)
            .replace(this.getRegFindVarParamType(), param.dataType);
    }
    shiftParamVariables(variables, text) {
        if (variables.offset != null) {
            text = text.replace(variables.regFindVar, (match, p1) => {
                // Shift variables $n or ${n:xxx}
                if (match.startsWith('${'))
                    return '${' + String(++variables.offset);
                else //if (match.startsWith('$'))
                    return '$' + String(++variables.offset);
            });
        }
        return text;
    }
}
exports.PLDocController = PLDocController;
//# sourceMappingURL=pldoc.controller.js.map