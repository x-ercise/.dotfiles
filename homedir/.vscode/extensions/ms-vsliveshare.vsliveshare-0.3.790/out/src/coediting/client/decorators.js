"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
const vscode = require("vscode");
const colorString = require("color-string");
var NameTagVisibility;
(function (NameTagVisibility) {
    NameTagVisibility["Never"] = "Never";
    NameTagVisibility["Activity"] = "Activity";
    NameTagVisibility["Always"] = "Always";
})(NameTagVisibility = exports.NameTagVisibility || (exports.NameTagVisibility = {}));
var CursorMode;
(function (CursorMode) {
    CursorMode[CursorMode["NameTag"] = 0] = "NameTag";
    CursorMode[CursorMode["Caret"] = 1] = "Caret";
})(CursorMode || (CursorMode = {}));
class TextEditorDecoratorBase {
    constructor(color) {
        this.color = color;
        this.backgroundCssColor = DecoratorUtils.toCssColor(this.color.backgroundColor);
        this.textCssColor = DecoratorUtils.toCssColor(this.color.textColor);
    }
    dispose() {
        if (this.decoration) {
            this.decoration.dispose();
        }
    }
    render(renderInEditors, cursorPos, selectionRange) {
        if (this.decoration) {
            this.decoration.dispose();
        }
        if (!renderInEditors || !renderInEditors.length || !cursorPos || !selectionRange) {
            return;
        }
        this._createDecorationStyle(cursorPos, selectionRange);
        this._renderCore(renderInEditors, cursorPos, selectionRange);
    }
}
exports.TextEditorDecoratorBase = TextEditorDecoratorBase;
class CursorDecorator extends TextEditorDecoratorBase {
    constructor(color, displayName) {
        super(color);
        this.displayName = displayName;
    }
    _renderCore(renderInEditors, cursorPos, selectionRange) {
        const decoratorRange = new vscode.Range(cursorPos, cursorPos);
        const renderOptions = {
            range: decoratorRange
        };
        if (selectionRange.isEmpty) {
            // TODO: When https://github.com/Microsoft/vscode/issues/37401 is fixed, we will also need to add a check
            // for the nameTagVisibility. If it is set to Always, then this hover message should not be shown
            // (because the name tag will already be shown).
            renderOptions.hoverMessage = this.displayName;
        }
        renderInEditors.forEach((editor) => {
            editor.setDecorations(this.decoration, [renderOptions]);
        });
    }
    _createDecorationStyle(cursorPos, selectionRange) {
        const leftMarginValue = cursorPos.character === 0 ? '0.17' : '0.25';
        const cursorCssRules = {
            position: 'absolute',
            display: 'inline-block',
            top: `0`,
            'font-size': '200%',
            'font-weight': 'bold',
            'z-index': 1
        };
        const stringifiedNameTagCss = DecoratorUtils.stringifyCssProperties(cursorCssRules);
        const decorationOptions = {
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
            before: {
                contentText: 'ᛙ',
                margin: `0px 0px 0px -${leftMarginValue}ch`,
                color: this.backgroundCssColor,
                textDecoration: `none; ${stringifiedNameTagCss}`
            }
        };
        this.decoration = vscode.window.createTextEditorDecorationType(decorationOptions);
    }
}
exports.CursorDecorator = CursorDecorator;
class NameTagDecorator extends TextEditorDecoratorBase {
    constructor(color, displayName) {
        super(color);
        this.displayName = displayName;
    }
    _renderCore(renderInEditors, cursorPos, selectionRange) {
        const decoratorRange = new vscode.Range(cursorPos, cursorPos);
        renderInEditors.forEach((editor) => {
            editor.setDecorations(this.decoration, [decoratorRange]);
        });
    }
    _createDecorationStyle(cursorPos, selectionRange) {
        let showAbove = true;
        // Name tag goes below if cursor is on 1st line or if there is a multiline, non-reversed selection.
        if (cursorPos.line === 0 || selectionRange && !selectionRange.isEmpty && !selectionRange.isSingleLine && selectionRange.end.isEqual(cursorPos)) {
            showAbove = false;
        }
        const topValue = showAbove ? -1 : 1;
        const nameTagCssRules = {
            position: 'absolute',
            top: `${topValue}rem`,
            'border-radius': '0.15rem',
            padding: '0px 0.5ch',
            display: 'inline-block',
            'pointer-events': 'none',
            color: this.textCssColor,
            'font-size': '0.7rem',
            'z-index': 1,
            'font-weight': 'bold'
        };
        const stringifiedNameTagCss = DecoratorUtils.stringifyCssProperties(nameTagCssRules);
        const decorationOptions = {
            backgroundColor: this.backgroundCssColor,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
            textDecoration: 'none; position: relative; z-index: 1;',
            after: {
                contentText: this.displayName,
                backgroundColor: this.backgroundCssColor,
                textDecoration: `none; ${stringifiedNameTagCss}`
            }
        };
        this.decoration = vscode.window.createTextEditorDecorationType(decorationOptions);
    }
}
exports.NameTagDecorator = NameTagDecorator;
class RulerDecorator extends TextEditorDecoratorBase {
    constructor(color) {
        super(color.withBackgroundAlpha(0.6));
    }
    _renderCore(renderInEditors, cursorPos, selectionRange) {
        const decoratorRange = new vscode.Range(cursorPos, cursorPos);
        renderInEditors.forEach((editor) => {
            editor.setDecorations(this.decoration, [decoratorRange]);
        });
    }
    _createDecorationStyle(cursorPos, selectionRange) {
        this.decoration = vscode.window.createTextEditorDecorationType({
            overviewRulerLane: vscode.OverviewRulerLane.Full,
            overviewRulerColor: this.backgroundCssColor
        });
    }
}
exports.RulerDecorator = RulerDecorator;
class SelectionDecorator extends TextEditorDecoratorBase {
    constructor(color, displayName) {
        super(color.withBackgroundAlpha(0.35));
        this.displayName = displayName;
    }
    _renderCore(renderInEditors, cursorPos, selectionRange) {
        if (selectionRange.isEmpty) {
            return;
        }
        const renderOptions = {
            range: selectionRange,
            hoverMessage: this.displayName
        };
        renderInEditors.forEach((editor) => {
            editor.setDecorations(this.decoration, [renderOptions]);
        });
    }
    _createDecorationStyle(cursorPos, selectionRange) {
        this.decoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: this.backgroundCssColor,
            borderRadius: '0.1rem'
        });
    }
}
exports.SelectionDecorator = SelectionDecorator;
class ClientDecoratorManager {
    constructor(clientId, clientDisplayName, nameTagVisibility, positionTracker) {
        this.clientId = clientId;
        this.clientDisplayName = clientDisplayName;
        this.clientColor = SharedColors.requestColor(clientId);
        this.nameTagVisibility = nameTagVisibility;
        this.positionTracker = positionTracker;
        this.selectionDecorator = new SelectionDecorator(this.clientColor, this.clientDisplayName);
        this.cursorDecorator = new CursorDecorator(this.clientColor, this.clientDisplayName);
        this.nameTagDecorator = new NameTagDecorator(this.clientColor, this.clientDisplayName);
        this.rulerDecorator = new RulerDecorator(this.clientColor);
    }
    dispose() {
        if (this.nameTagVisibilityTimer) {
            clearTimeout(this.nameTagVisibilityTimer);
        }
        this.disposeDecorators();
    }
    updateDecorators() {
        const lastTrackedPosition = this.positionTracker.getClientPosition(this.clientId);
        const renderInEditors = [];
        if (lastTrackedPosition) {
            vscode.window.visibleTextEditors.forEach((editor) => {
                if (editor.document.uri.toString() === lastTrackedPosition.documentUri) {
                    renderInEditors.push(editor);
                }
            });
        }
        if (!renderInEditors.length) {
            // This client is not in a currently visible editor (splitview tab).
            this.disposeDecorators();
            return;
        }
        const selectionRange = lastTrackedPosition.range;
        const cursorPosition = lastTrackedPosition.isReversed ? selectionRange.start : selectionRange.end;
        this.selectionDecorator.render(renderInEditors, cursorPosition, selectionRange);
        this.rulerDecorator.render(renderInEditors, cursorPosition, selectionRange);
        switch (this.nameTagVisibility) {
            case NameTagVisibility.Always:
                this.cursorDecorator.render(renderInEditors, cursorPosition, selectionRange);
                this.nameTagDecorator.render(renderInEditors, cursorPosition, selectionRange);
                break;
            case NameTagVisibility.Never:
                this.cursorDecorator.render(renderInEditors, cursorPosition, selectionRange);
                if (this.nameTagDecorator) {
                    this.nameTagDecorator.dispose();
                }
                break;
            case NameTagVisibility.Activity:
            default:
                clearTimeout(this.nameTagVisibilityTimer);
                this.cursorDecorator.render(renderInEditors, cursorPosition, selectionRange);
                this.nameTagDecorator.render(renderInEditors, cursorPosition, selectionRange);
                this.nameTagVisibilityTimer = setTimeout(() => {
                    this.nameTagDecorator.dispose();
                }, 1500);
                break;
        }
    }
    disposeDecorators() {
        this.selectionDecorator.dispose();
        this.cursorDecorator.dispose();
        this.nameTagDecorator.dispose();
        this.rulerDecorator.dispose();
    }
}
exports.ClientDecoratorManager = ClientDecoratorManager;
class DecoratorColor {
    constructor(backgroundColor, textColor) {
        this.backgroundColor = backgroundColor;
        this.textColor = textColor;
    }
    /**
     * Returns a new DecoratorColor instance based on this one, with the alpha channel set to the given value for the background.
     * @param alpha The desired transparency, from 0 (transparent) to 1 (opaque)
     */
    withBackgroundAlpha(alpha) {
        // Clamp alpha between 0 and 1
        alpha = Math.max(0, alpha);
        alpha = Math.min(1, alpha);
        const newBgColor = new vscode.Color(this.backgroundColor.red, this.backgroundColor.green, this.backgroundColor.blue, alpha);
        return new DecoratorColor(newBgColor, this.textColor);
    }
}
class SharedColors {
    static requestColor(clientId) {
        SharedColors._initcolors();
        return SharedColors.allColors[clientId % SharedColors.allColors.length];
    }
    static _initcolors() {
        if (SharedColors.allColors) {
            return;
        }
        // Colors are used in order. Earlier in the array means they will be used first.
        const defaultColors = [
            // Yellow
            ['rgba(0, 0, 0, 1)', 'rgba(255, 185, 0, 1)'],
            // Green
            ['rgba(255, 255, 255, 1)', 'rgba(16, 124, 16, 1)'],
            // Magenta
            ['rgba(255, 255, 255, 1)', 'rgba(180, 0, 158, 1)'],
            // Light green
            ['rgba(0, 0, 0, 1)', 'rgba(186, 216, 10, 1)'],
            // Light orange
            ['rgba(0, 0, 0, 1)', 'rgba(255, 140, 0, 1)'],
            // Light magenta
            ['rgba(255, 255, 255, 1)', 'rgba(227, 0, 140, 1)'],
            // Purple
            ['rgba(255, 255, 255, 1)', 'rgba(92, 45, 145, 1)'],
            // Light teal
            ['rgba(0, 0, 0, 1)', 'rgba(0, 178, 148, 1)'],
            // Light yellow
            ['rgba(0, 0, 0, 1)', 'rgba(255, 241, 0, 1)'],
            // Light purple
            ['rgba(0, 0, 0, 1)', 'rgba(180, 160, 255, 1)']
        ];
        const colorCustomizations = vscode.workspace.getConfiguration('workbench.colorCustomizations');
        let cursorForegroundBackgroundColors = (colorCustomizations && colorCustomizations['cascade.cursorForegroundBackgroundColors']);
        if (cursorForegroundBackgroundColors && Array.isArray(cursorForegroundBackgroundColors)) {
            SharedColors.allColors = SharedColors.parseColors(cursorForegroundBackgroundColors);
        }
        if (!SharedColors.allColors || !SharedColors.allColors.length) {
            SharedColors.allColors = SharedColors.parseColors(defaultColors);
        }
    }
    static parseColors(colorStringPairs) {
        const parsedColors = colorStringPairs
            .map((colorPair) => {
            if (colorPair && colorPair.length === 2) {
                const foregroundColor = DecoratorUtils.toVSCodeColor(colorPair[0]);
                const backgroundColor = DecoratorUtils.toVSCodeColor(colorPair[1]);
                if (!foregroundColor || !backgroundColor) {
                    // Can't parse color.
                    return null;
                }
                return new DecoratorColor(backgroundColor, foregroundColor);
            }
        })
            .filter((color) => !!color)
            .reverse();
        return parsedColors;
    }
}
exports.SharedColors = SharedColors;
class DecoratorUtils {
    static stringifyCssProperties(rules) {
        return Object.keys(rules)
            .map((rule) => {
            return `${rule}: ${rules[rule]};`;
        })
            .join(' ');
    }
    static toCssColor(color) {
        const r = Math.round(color.red * 255);
        const g = Math.round(color.green * 255);
        const b = Math.round(color.blue * 255);
        return `rgba(${r}, ${g}, ${b}, ${color.alpha})`;
    }
    static toVSCodeColor(color) {
        try {
            const [r, g, b, a] = colorString.get.rgb(color);
            return new vscode.Color(r / 255, g / 255, b / 255, a);
        }
        catch (e) {
            // colorString couldn't parse the color out of that string.
            return null;
        }
    }
    static isSamePosition(p1, p2) {
        if (p1 === null || p2 === null) {
            return false;
        }
        return p1.isEqual(p2);
    }
    static isSameRange(r1, r2) {
        if (r1 === null || r2 === null) {
            return false;
        }
        return r1.isEqual(r2);
    }
}

//# sourceMappingURL=decorators.js.map
