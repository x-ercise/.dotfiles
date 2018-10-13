"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = require("../config");
const Dependencies_1 = require("./Dependencies");
const liveShare_1 = require("../api/liveShare");
const buildCommandName = (commandName) => {
    return `${config.get(config.Key.commandPrefix)}.${commandName}`;
};
const SHARE_COMMAND_PATH = './commands/ShareCommand';
const JOIN_POSTRELOAD_COMMAND_PATH = './commands/JoinPostReloadCommand';
const JOIN_PRERELOAD_COMMAND_PATH = './commands/JoinPreReloadCommand';
class ExtensionSetup {
    constructor(commandRegistryProvider, agentSessionContextUpdateListener, configUtil) {
        this.commandRegistryProvider = commandRegistryProvider;
        this.agentSessionContextUpdateListener = agentSessionContextUpdateListener;
        this.configUtil = configUtil;
        this.didInit = false;
        this.commandFiles = {};
    }
    async init() {
        // Setup listener to track session context updates
        this.agentSessionContextUpdateListener.subscribe();
        // enable new share command for experimental or internal
        if (config.featureFlags.newShareCommand) {
            this.registerShareCommand();
        }
        // enable the new join commands only to the team memebers
        if (config.isVSLSTeamMember()) {
            this.registerJoinCommand();
        }
        // Register commands with the client
        Object.keys(this.commandFiles).forEach((command) => {
            this.commandRegistryProvider.register(command, this.getCommandBuilder(this.commandFiles[command]));
        });
        this.didInit = true;
    }
    registerShareCommand() {
        // enable share commands
        const shareCommandNames = [
            buildCommandName('start'),
            buildCommandName('startFromFileTreeExplorer'),
            buildCommandName('startFromActivityBar'),
        ];
        for (let shareCommandName of shareCommandNames) {
            this.commandFiles[shareCommandName] = {
                path: SHARE_COMMAND_PATH
            };
        }
        // enable read-only share commands
        if (config.featureFlags.accessControl) {
            const shareReadOnlyCommandNames = [
                buildCommandName('startReadOnly'),
                buildCommandName('startReadOnlyFromFileTreeExplorer'),
                buildCommandName('startReadOnlyFromActivityBar'),
            ];
            for (let shareReadOnlyCommandName of shareReadOnlyCommandNames) {
                this.commandFiles[shareReadOnlyCommandName] = {
                    path: SHARE_COMMAND_PATH,
                    options: { access: liveShare_1.Access.ReadOnly }
                };
            }
        }
    }
    registerJoinCommand() {
        // enable join post reload command
        const joinPostReloadCommandNames = [
            buildCommandName('join.postReload'),
        ];
        for (let joinPostReloadCommandName of joinPostReloadCommandNames) {
            this.commandFiles[joinPostReloadCommandName] = {
                path: JOIN_POSTRELOAD_COMMAND_PATH
            };
        }
        // enable join pre reload command
        const joinPreReloadCommandNames = [
            buildCommandName('join'),
            buildCommandName('joinFromFileTreeExplorer'),
            buildCommandName('joinFromActivityBar'),
        ];
        for (let joinPreReloadCommandName of joinPreReloadCommandNames) {
            this.commandFiles[joinPreReloadCommandName] = {
                path: JOIN_PRERELOAD_COMMAND_PATH
            };
        }
    }
    async dispose() {
        if (!this.didInit) {
            return;
        }
        this.commandRegistryProvider.disposeAll();
        this.agentSessionContextUpdateListener.dispose();
    }
    getCommandBuilder(commandData) {
        return () => {
            const builder = require(commandData.path).builder;
            const command = builder(Dependencies_1.dependencies);
            return {
                invoke: (options, context) => command.invoke(Object.assign({}, commandData.options, options), context)
            };
        };
    }
}
exports.ExtensionSetup = ExtensionSetup;

//# sourceMappingURL=ExtensionSetup.js.map
