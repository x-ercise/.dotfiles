"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path = require("path");
/**
 * Function to check if the folder is LiveShare extension directory.
 * @param pathComponents
 *      - @source - the path to the folder.
 *      - @name - folder name.
 * @returns Whether the folder is the LiveShare extension directory.
 */
const isLiveShareExtensionDirectory = (pathComponents) => {
    const { source, name } = pathComponents;
    const folderPath = path.join(source, name);
    const isDirectory = fs_1.lstatSync(folderPath).isDirectory();
    if (isDirectory) {
        return (name.indexOf('ms-vsliveshare.vsliveshare') > -1);
    }
    return false;
};
/**
 * Function to get all liveshare directory names form the VSCode extensions directory.
 * @param source Path to the extensions directory.
 */
const getLiveShareExtensionDirectories = (source) => {
    return fs_1.readdirSync(source)
        .map((name) => { return { source, name }; })
        .filter(isLiveShareExtensionDirectory);
};
/**
 * Function to check whether the current extension is the only LiveShare extension in the VSCode extensions folder.
 * @returns Whether the current extension is the only LiveShare extension in the VSCode extensions folder.
 */
exports.isExtensionBeingUpdated = () => {
    try {
        const liveShareExtensionRoot = path.join(__filename, '../../../../');
        const vscodeExtensionsRoot = path.join(liveShareExtensionRoot, '../');
        const directories = getLiveShareExtensionDirectories(vscodeExtensionsRoot);
        return (directories.length > 1);
    }
    catch (e) {
        return false;
    }
};

//# sourceMappingURL=abTestsUtil.js.map
