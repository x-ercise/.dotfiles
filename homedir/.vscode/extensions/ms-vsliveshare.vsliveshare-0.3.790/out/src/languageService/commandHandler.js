"use strict";
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const vscodeLSP = require("vscode-languageclient");
const p2cExt = require("./protocol2codeExtension");
const util_1 = require("../util");
const REMOTE_COMMAND_NAME = '_liveshare.remotecommand';
// Commands that should run directly on the guest machine
const localCommands = ['vscode.open', 'editor.action.showReferences'];
/**
 * Some VSCode commands have constraints on their parameters and validate the types at runtime.
 * For paratmers of type Uri lose their type identity when serialized to JSON and re-hydrated.
 * So for the vscode commands where constraints are enforced, we need to handle the serialization and deserialization.
 * The list of VS Code commands with their constraints is here - https://github.com/Microsoft/vscode/blob/master/src/vs/workbench/api/node/extHostApiCommands.ts
 */
const commandConverters = {};
function isSafeCommand(command) {
    return command.startsWith('vscode') || command.startsWith('editor');
}
exports.isSafeCommand = isSafeCommand;
/**
 * Wrap the given vscode command as the argument of a specific REMOTE_COMMAND_NAME for which the guest registers a handler.
 * The handler knows to either send the command back to the host or execute locally on the guest.
 */
function wrapCommand(command, c2pConverter, c2pConverterExtension) {
    const commandConverter = commandConverters[command.command];
    if (commandConverter) {
        command = commandConverter.toProtocol(command, c2pConverter, c2pConverterExtension);
    }
    let remoteCommand = {
        title: command.title,
        command: REMOTE_COMMAND_NAME,
        tooltip: command.tooltip,
        arguments: [command]
    };
    return c2pConverter.asCommand(remoteCommand);
}
exports.wrapCommand = wrapCommand;
/**
 * The handler for the LiveShare remote command that knows to either run a command locally or send it to the host for execution.
 * These are commands returned for CodeActions or CodeLenses.
 */
async function handleLiveShareRemoteCommand(args, lspClient, p2cConverter) {
    if (args.command) { // A Command returned by VS or VS Code
        let command = args;
        if (localCommands.indexOf(command.command) >= 0) { // Run command locally
            const commandConverter = commandConverters[command.command];
            if (commandConverter) {
                command = commandConverter.toCode(command, p2cConverter);
            }
            let commandArgs = command.arguments || [];
            vscode.commands.executeCommand(command.command, ...commandArgs);
        }
        else {
            let params = {
                command: command.command,
                arguments: command.arguments
            };
            const commandRun = await lspClient.sendRequest(vscodeLSP.ExecuteCommandRequest.type, params);
            if (typeof commandRun === 'boolean' && !commandRun) { // Older clients may return null rather than a boolean
                let result = await vscode.window.showErrorMessage('The host doesn’t allow running this command. If needed, ask them to enable it.', 'More info');
                if (result) {
                    util_1.ExtensionUtil.openBrowser('https://aka.ms/vsls-security#code-commands');
                }
            }
        }
    }
    else if (args.edit) { // A CodeAction returned by VS (VS Code doesn't wrap CodeActions in Commands)
        let workspaceEdit = args.edit;
        vscode.workspace.applyEdit(p2cConverter.asWorkspaceEdit(workspaceEdit));
    }
}
exports.handleLiveShareRemoteCommand = handleLiveShareRemoteCommand;
const openCommandConverter = {
    toProtocol: (command, c2p, c2pExt) => {
        let uri = command.arguments[0];
        command.arguments[0] = c2p.asUri(uri);
        return command;
    },
    toCode: (command, p2c) => {
        let uri = command.arguments[0];
        command.arguments[0] = p2c.asUri(uri);
        return command;
    }
};
const showReferencesCommandConverter = {
    toProtocol: (command, c2p, c2pExt) => {
        let uri = command.arguments[0];
        let position = command.arguments[1];
        let locations = command.arguments[2];
        command.arguments[0] = c2p.asUri(uri);
        command.arguments[1] = c2p.asPosition(position);
        command.arguments[2] = locations.map(l => c2pExt.asLocation(l));
        return command;
    },
    toCode: (command, p2c) => {
        let uri = command.arguments[0];
        let position = command.arguments[1];
        let locations = command.arguments[2];
        command.arguments[0] = p2c.asUri(uri);
        command.arguments[1] = p2c.asPosition(position);
        command.arguments[2] = locations.map(l => p2cExt.asLocation(l, p2c));
        return command;
    }
};
commandConverters['vscode.open'] = openCommandConverter;
commandConverters['editor.action.showReferences'] = showReferencesCommandConverter;

//# sourceMappingURL=commandHandler.js.map
