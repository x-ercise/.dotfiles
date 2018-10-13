"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const path = require("path");
const decorators_1 = require("../coediting/client/decorators");
const traceSource_1 = require("../tracing/traceSource");
const renderUserCircleIcon_1 = require("./renderUserCircleIcon");
exports.iconsRoot = path.join(__filename, '../../../../images/');
class IconsProvider {
    constructor() {
        this.trace = traceSource_1.traceSource.withName('IconsProvider');
        this.icons = {};
        this.createIconBundle = async (color) => {
            const cleanColorName = color.replace(/\,|\.|\(|\)|\s/gim, '_');
            const normalPath = path.join(exports.iconsRoot, `./user-icon-${cleanColorName}-icon.svg`);
            const filledPath = path.join(exports.iconsRoot, `./user-icon-${cleanColorName}-filled-icon.svg`);
            if (fs.pathExistsSync(normalPath) && fs.pathExistsSync(filledPath)) {
                return {
                    normal: normalPath,
                    filled: filledPath
                };
            }
            await fs.writeFile(normalPath, renderUserCircleIcon_1.renderCircleIcon(color, false));
            await fs.writeFile(filledPath, renderUserCircleIcon_1.renderCircleIcon(color, true));
            return {
                normal: normalPath,
                filled: filledPath
            };
        };
    }
    async getIcon(color) {
        const currentIcon = this.icons[color];
        if (currentIcon) {
            return currentIcon;
        }
        try {
            this.icons[color] = await this.createIconBundle(color);
        }
        catch (e) {
            this.trace.error(`${e.message}:\n ${e.stack}`);
            return null;
        }
        return this.icons[color];
    }
    async getIconByUserId(userId) {
        const color = decorators_1.SharedColors.requestColor(userId);
        const { backgroundColor, textColor } = color;
        const red = parseInt(`${255 * backgroundColor.red}`, 10);
        const green = parseInt(`${255 * backgroundColor.green}`, 10);
        const blue = parseInt(`${255 * backgroundColor.blue}`, 10);
        const colorString = `rgb(${red}, ${green}, ${blue})`;
        return await this.getIcon(colorString);
    }
}
exports.userIconProvider = new IconsProvider();

//# sourceMappingURL=UserIconsProvider.js.map
