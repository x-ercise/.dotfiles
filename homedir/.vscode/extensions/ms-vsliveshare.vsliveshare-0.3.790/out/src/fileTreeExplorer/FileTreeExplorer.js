"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const UserIconsProvider_1 = require("./UserIconsProvider");
const sessionTypes_1 = require("../sessionTypes");
const config_1 = require("../config");
const liveShare_1 = require("../api/liveShare");
var TreeItemType;
(function (TreeItemType) {
    // top level items
    TreeItemType["Participants"] = "participants";
    TreeItemType["Servers"] = "servers";
    TreeItemType["Terminals"] = "terminals";
    TreeItemType["DefaultAction"] = "defaultaction";
    TreeItemType["Loader"] = "loader";
    // tree leaf items
    // participants
    TreeItemType["FollowedGuest"] = "followedguest";
    TreeItemType["FollowedParticipant"] = "followedparticipant";
    TreeItemType["Participant"] = "participant";
    TreeItemType["CurrentUser"] = "currentuser";
    TreeItemType["Guest"] = "guest";
    // server
    TreeItemType["LocalServer"] = "localserver";
    TreeItemType["RemoteServer"] = "remoteserver";
    // terminal
    TreeItemType["LocalTerminalReadOnly"] = "localterminal.readonly";
    TreeItemType["LocalTerminalReadWrite"] = "localterminal.readwrite";
    TreeItemType["RemoteTerminal"] = "remoteterminal";
})(TreeItemType || (TreeItemType = {}));
var FileTreeExplorerType;
(function (FileTreeExplorerType) {
    FileTreeExplorerType["ViewletActivityBar"] = "ActivityBar";
    FileTreeExplorerType["ViewletFileTreeExplorer"] = "FileTreeExplorer";
})(FileTreeExplorerType = exports.FileTreeExplorerType || (exports.FileTreeExplorerType = {}));
class FileTreeExplorerProvider {
    // tslint:enable
    constructor(sessionContext, initiator) {
        this.sessionContext = sessionContext;
        this.initiator = initiator;
        // tslint:disable
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.refresh = () => {
            this._onDidChangeTreeData.fire();
        };
        this.sessionContext.addListener(sessionTypes_1.SessionEvents.StateChanged, this.refresh);
        this.sessionContext.addListener(sessionTypes_1.SessionEvents.CollaboratorsChanged, this.refresh);
        this.sessionContext.addListener(sessionTypes_1.SessionEvents.ReadOnlyChanged, this.refresh);
    }
    getTreeItem(element) { return element; }
    async getElementChildren(element) {
        switch (element.contextValue) {
            case TreeItemType.Participants:
                return await this.getParticipantsChildren();
            case TreeItemType.Servers:
                return await this.getServersChildren();
            case TreeItemType.Terminals:
                return await this.getTerminalsChildren();
            default:
                return [];
        }
    }
    getDefaultParticipantsActions() {
        return [
            new FileTreeExplorerItemCommon({
                type: TreeItemType.DefaultAction,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                label: 'Invite participants...',
                command: {
                    title: 'Invite participants...',
                    command: (this.initiator === FileTreeExplorerType.ViewletFileTreeExplorer)
                        ? 'liveshare.collaboration.link.copyFromFileTreeExplorer'
                        : 'liveshare.collaboration.link.copyFromActivityBar'
                }
            })
        ];
    }
    getDefaultTerminalsActions() {
        if (this.sessionContext.coeditingClient.isOwner) {
            return [
                new FileTreeExplorerItemCommon({
                    type: TreeItemType.DefaultAction,
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    label: 'Share terminal...',
                    command: {
                        title: 'Share terminal...',
                        command: (this.initiator === FileTreeExplorerType.ViewletFileTreeExplorer)
                            ? 'liveshare.shareTerminalFromFileTreeExplorer'
                            : 'liveshare.shareTerminalFromActivityBar'
                    }
                })
            ];
        }
        return [
            new FileTreeExplorerItemCommon({
                type: TreeItemType.DefaultAction,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                label: 'No terminals shared'
            })
        ];
    }
    getDefaultServersActions() {
        if (this.sessionContext.coeditingClient.isOwner) {
            return [
                new FileTreeExplorerItemCommon({
                    type: TreeItemType.DefaultAction,
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    label: 'Share server...',
                    command: {
                        title: 'Share server...',
                        command: (this.initiator === FileTreeExplorerType.ViewletFileTreeExplorer)
                            ? 'liveshare.shareServerFromFileTreeExplorer'
                            : 'liveshare.shareServerFromActivityBar'
                    }
                })
            ];
        }
        return [
            new FileTreeExplorerItemCommon({
                type: TreeItemType.DefaultAction,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                label: 'No servers shared'
            })
        ];
    }
    getApprovedParticipants() {
        const result = [];
        const participants = this.sessionContext.collaboratorManager.getCollaborators();
        const participantIds = this.sessionContext.collaboratorManager.getCollaboratorSessionIds();
        for (let profileKey of participantIds) {
            const participant = participants[profileKey];
            const sessionId = parseInt(profileKey, 10);
            // if not current user
            if (sessionId !== this.sessionContext.coeditingClient.clientID) {
                result.push({
                    sessionId,
                    participant
                });
            }
        }
        return result;
    }
    async getParticipantsChildren() {
        const result = [];
        if (!this.sessionContext.collaboratorManager) {
            return result;
        }
        const approvedParticipants = this.getApprovedParticipants();
        for (let approvedParticipant of approvedParticipants) {
            const { sessionId, participant } = approvedParticipant;
            result.push(await this.getParticipantRow(sessionId, participant));
        }
        return (result.length === 0)
            ? this.getDefaultParticipantsActions()
            : result;
    }
    async getServersChildren() {
        const result = [];
        if (!this.serverSharingService) {
            return result;
        }
        const sharedServers = (this.sessionContext.coeditingClient.isOwner)
            ? await this.serverSharingService.getSharedServersAsync()
            : await this.portForwardingService.getSharedServersAsync();
        for (let server of sharedServers) {
            result.push(await this.getServerRow(server, this.sessionContext.coeditingClient.isOwner));
        }
        return (result.length === 0)
            ? this.getDefaultServersActions()
            : result;
    }
    async getTerminalsChildren() {
        const result = [];
        if (!this.terminalService) {
            return result;
        }
        const sharedTerminals = await this.terminalService.getRunningTerminalsAsync();
        for (let terminal of sharedTerminals) {
            result.push(await this.getTerminalRow(terminal, this.sessionContext.coeditingClient.isOwner));
        }
        return (result.length === 0)
            ? this.getDefaultTerminalsActions()
            : result;
    }
    async getDefaultRootChildren() {
        const isSharedState = (this.sessionContext.State === sessionTypes_1.SessionState.Shared);
        const isJoinedState = (this.sessionContext.State === sessionTypes_1.SessionState.Joined);
        const isSharingState = (this.sessionContext.State === sessionTypes_1.SessionState.SharingInProgress);
        const isJoiningState = (this.sessionContext.State === sessionTypes_1.SessionState.JoiningInProgress);
        if (isSharingState || isJoiningState) {
            return [
                new FileTreeExplorerItemCommon({
                    type: TreeItemType.Loader,
                    label: (isSharingState) ? 'Starting collaboration session...' : 'Joining collaboration session...',
                    iconPath: {
                        dark: path.join(UserIconsProvider_1.iconsRoot, '/dark/loading.svg'),
                        light: path.join(UserIconsProvider_1.iconsRoot, '/light/loading.svg')
                    }
                })
            ];
        }
        else if (!isSharedState && !isJoinedState) {
            const sharecommand = (this.initiator === FileTreeExplorerType.ViewletFileTreeExplorer)
                ? 'liveshare.startFromFileTreeExplorer'
                : 'liveshare.startFromActivityBar';
            const joinCommand = (this.initiator === FileTreeExplorerType.ViewletFileTreeExplorer)
                ? 'liveshare.joinFromFileTreeExplorer'
                : 'liveshare.joinFromActivityBar';
            let result = [
                new FileTreeExplorerItemCommon({
                    type: TreeItemType.DefaultAction,
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    label: `Join collaboration session...`,
                    command: {
                        title: 'Join collaboration session...',
                        command: joinCommand
                    }
                }),
                new FileTreeExplorerItemCommon({
                    type: TreeItemType.DefaultAction,
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    label: `Start collaboration session...`,
                    command: {
                        title: 'Start collaboration session..',
                        command: sharecommand
                    }
                })
            ];
            if (config_1.featureFlags.accessControl) {
                const shareOptions = { access: liveShare_1.Access.ReadOnly };
                const shareReadOnlyCommand = (this.initiator === FileTreeExplorerType.ViewletFileTreeExplorer)
                    ? 'liveshare.startReadOnlyFromFileTreeExplorer'
                    : 'liveshare.startReadOnlyFromActivityBar';
                result.push(new FileTreeExplorerItemCommon({
                    type: TreeItemType.DefaultAction,
                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                    label: `Start read-only collaboration session...`,
                    command: {
                        title: 'Start read-only collaboration session..',
                        command: shareReadOnlyCommand,
                        arguments: [shareOptions]
                    }
                }));
            }
            return result;
        }
        const approvedParticipants = this.getApprovedParticipants();
        const sharedServers = await this.serverSharingService.getSharedServersAsync();
        const sharedTerminals = await this.terminalService.getRunningTerminalsAsync();
        return [
            new FileTreeExplorerItemCommon({
                type: TreeItemType.Participants,
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                label: `Participants (${approvedParticipants.length})`
            }),
            new FileTreeExplorerItemCommon({
                type: TreeItemType.Servers,
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                label: `Shared Servers (${sharedServers.length})`
            }),
            new FileTreeExplorerItemCommon({
                type: TreeItemType.Terminals,
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                label: `Shared Terminals (${sharedTerminals.length})`
            })
        ];
    }
    async getChildren(element) {
        if (element) {
            return await this.getElementChildren(element);
        }
        return await this.getDefaultRootChildren();
    }
    getUserTreeItemType(sessionId) {
        const { coeditingClient } = this.sessionContext;
        const followedUsers = coeditingClient.getUsersBeingFollowed();
        if (followedUsers[sessionId]) {
            return (this.sessionContext.coeditingClient.isOwner)
                ? TreeItemType.FollowedGuest
                : TreeItemType.FollowedParticipant;
        }
        return (this.sessionContext.coeditingClient.isOwner)
            ? TreeItemType.Guest
            : TreeItemType.Participant;
    }
    async getServerRow(sharedServer, isLocalServer) {
        const row = new ServerFileTreeExplorerItem({
            sourcePort: isLocalServer ? sharedServer.sourcePort : sharedServer.destinationPort,
            type: (isLocalServer)
                ? TreeItemType.LocalServer
                : TreeItemType.RemoteServer,
            label: sharedServer.sessionName,
            iconPath: {
                dark: path.join(UserIconsProvider_1.iconsRoot, '/dark/server.svg'),
                light: path.join(UserIconsProvider_1.iconsRoot, '/light/server.svg')
            },
            tooltip: `${sharedServer.sessionName}${!isLocalServer && sharedServer.destinationPort !== sharedServer.sourcePort ? ` shared as localhost:${sharedServer.destinationPort}` : ''}`,
            command: {
                title: 'Open Server in Browser',
                command: (this.initiator === FileTreeExplorerType.ViewletFileTreeExplorer)
                    ? 'liveshare.openServerInBrowserFromFileTreeExplorer'
                    : 'liveshare.openServerInBrowserFromActivityBar',
                arguments: [{ sourcePort: isLocalServer ? sharedServer.sourcePort : sharedServer.destinationPort }]
            }
        });
        return row;
    }
    async getTerminalRow(sharedTerminal, isLocalTerminal) {
        const readOnlyForGuests = sharedTerminal.options.readOnlyForGuests || this.sessionContext.IsReadOnly;
        const clearName = (sharedTerminal.options.name || '').replace('[Shared]', '');
        const row = new TerminalFileTreeExplorerItem({
            label: `${clearName.trim()} (${readOnlyForGuests ? 'Read-only' : 'Read/write'})`,
            terminalId: sharedTerminal.id,
            type: (isLocalTerminal)
                ? (sharedTerminal.options.readOnlyForGuests ? TreeItemType.LocalTerminalReadOnly : TreeItemType.LocalTerminalReadWrite)
                : TreeItemType.RemoteTerminal,
            iconPath: {
                dark: path.join(UserIconsProvider_1.iconsRoot, '/dark/terminal.svg'),
                light: path.join(UserIconsProvider_1.iconsRoot, '/light/terminal.svg')
            },
            command: {
                title: 'Focus terminal',
                command: (this.initiator === FileTreeExplorerType.ViewletFileTreeExplorer)
                    ? 'liveshare.openTerminalFromFileTreeExplorer'
                    : 'liveshare.openTerminalFromActivityBar',
                arguments: [{ terminalId: sharedTerminal.id }]
            }
        });
        return row;
    }
    async getParticipantRow(sessionId, participant) {
        const name = participant.name || participant.email;
        const { positionTracker } = this.sessionContext.coeditingClient;
        const fileTrackPosition = positionTracker.getClientPosition(sessionId);
        let fileNamePostFix = '';
        let tooltipPostFix = '';
        if (fileTrackPosition && fileTrackPosition.fileName) {
            const fileName = path.basename(fileTrackPosition.fileName);
            const range = fileTrackPosition.range;
            const linePostfix = (range && range.start) ? `:${range.start.line + 1}` : '';
            fileNamePostFix = ` •  ${fileName}${linePostfix}`;
            tooltipPostFix = ` • ${fileTrackPosition.fileName}${linePostfix}`;
        }
        // participant icon
        const iconBundle = await UserIconsProvider_1.userIconProvider.getIconByUserId(sessionId);
        let iconPath;
        if (iconBundle) {
            const { coeditingClient } = this.sessionContext;
            const followedUsers = coeditingClient.getUsersBeingFollowed();
            const iconPathBundle = (followedUsers[sessionId])
                ? iconBundle.filled
                : iconBundle.normal;
            iconPath = {
                dark: iconPathBundle,
                light: iconPathBundle
            };
        }
        const userItemType = this.getUserTreeItemType(sessionId);
        const isFollowedParticipant = (userItemType === TreeItemType.FollowedGuest || userItemType === TreeItemType.FollowedParticipant);
        const commandTitle = isFollowedParticipant ? 'Unfollow Participant' : 'Follow Participant';
        const commandPrefix = isFollowedParticipant ? 'liveshare.unfollow' : 'liveshare.follow';
        const commandSuffix = (this.initiator === FileTreeExplorerType.ViewletFileTreeExplorer)
            ? `FromFileTreeExplorer`
            : `FromActivityBar`;
        const command = `${commandPrefix}${commandSuffix}`;
        const row = new ParticipantFileTreeExplorerItem({
            sessionId,
            type: userItemType,
            label: `${name} ${fileNamePostFix}`,
            tooltip: `${name} ${tooltipPostFix}`,
            iconPath,
            command: {
                title: commandTitle,
                command,
                arguments: [{ sessionId }]
            }
        });
        return row;
    }
    registerClientListeners(client) {
        client.onPin(this.refresh);
        client.onUnpin(this.refresh);
        client.onUpdateCoEditorPosition(this.refresh);
    }
    registerServicesListeners(serverSharingService, portForwardingService, terminalService) {
        this.serverSharingService = serverSharingService;
        this.portForwardingService = portForwardingService;
        this.terminalService = terminalService;
        serverSharingService.onSharingChanged(this.refresh);
        serverSharingService.onSharingStarted(this.refresh);
        serverSharingService.onSharingStopped(this.refresh);
        portForwardingService.onSharingChanged(this.refresh);
        portForwardingService.onSharingStarted(this.refresh);
        portForwardingService.onSharingStopped(this.refresh);
        terminalService.onTerminalStarted(this.refresh);
        terminalService.onTerminalStopped(this.refresh);
        terminalService.onTerminalReadOnlyChanged(this.refresh);
    }
}
exports.FileTreeExplorerProvider = FileTreeExplorerProvider;
class FileTreeExplorerItemCommon extends vscode.TreeItem {
    constructor(options) {
        super(options.label, options.collapsibleState || vscode.TreeItemCollapsibleState.None);
        this.options = options;
        this.label = options.label;
        this.tooltip = options.tooltip;
        this.command = options.command;
        this.iconPath = options.iconPath;
        this.contextValue = options.type;
    }
}
class ParticipantFileTreeExplorerItem extends FileTreeExplorerItemCommon {
    constructor(options) {
        super(options);
        this.options = options;
        this.sessionId = options.sessionId;
    }
}
exports.ParticipantFileTreeExplorerItem = ParticipantFileTreeExplorerItem;
class ServerFileTreeExplorerItem extends FileTreeExplorerItemCommon {
    constructor(options) {
        super(options);
        this.options = options;
        this.sourcePort = options.sourcePort;
    }
}
exports.ServerFileTreeExplorerItem = ServerFileTreeExplorerItem;
class TerminalFileTreeExplorerItem extends FileTreeExplorerItemCommon {
    constructor(options) {
        super(options);
        this.options = options;
        this.terminalId = options.terminalId;
    }
}
exports.TerminalFileTreeExplorerItem = TerminalFileTreeExplorerItem;

//# sourceMappingURL=FileTreeExplorer.js.map
