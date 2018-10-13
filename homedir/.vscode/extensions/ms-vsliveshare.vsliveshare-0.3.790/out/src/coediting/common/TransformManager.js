"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const coauthoringService_1 = require("./coauthoringService");
const traceSource_1 = require("../../tracing/traceSource");
const coeditingUtils_1 = require("./coeditingUtils");
class TransformManager {
    constructor(host) {
        this.serverVersionHistory = new Array();
        this.host = host;
        this.serverVersionHistory.push(new ServerVersion(-1, null));
    }
    AddToServersionHistory(serverVersion, message, translatedMessage) {
        let history = new ServerVersion(serverVersion, message);
        if ((translatedMessage !== null) && (message.changeServerVersion !== translatedMessage.changeServerVersion)) {
            history.AddMessage(translatedMessage);
        }
        this.serverVersionHistory.push(history);
    }
    RemoveUnacknowledgedChangesFromServerVersionHistory(numberOfUnacknowledgedChanges) {
        this.serverVersionHistory.splice(this.serverVersionHistory.length - numberOfUnacknowledgedChanges, numberOfUnacknowledgedChanges);
    }
    RollbackTo(serverVersionNumber) {
        for (let n = this.serverVersionHistory.length - 1; (n >= 0); --n) {
            if (this.serverVersionHistory[n].serverVersionNumber === serverVersionNumber) {
                this.serverVersionHistory.splice(n + 1);
                return;
            }
        }
        coeditingUtils_1.assert(false, 'Failed to find version number to remove');
    }
    get CurrentServerVersionNumber() {
        return this.serverVersionHistory[this.serverVersionHistory.length - 1].serverVersionNumber;
    }
    get CurrentHistory() {
        return this.serverVersionHistory.map((serverVersion) => serverVersion.clone());
    }
    setInitialHistory(serverVersions) {
        const newVersion = serverVersions[serverVersions.length - 1].serverVersionNumber;
        if (this.serverVersionHistory.length === 1 && this.serverVersionHistory[0].serverVersionNumber === -1) {
            this.serverVersionHistory = serverVersions;
            this.host.trace.info(`Setting initial history for ${traceSource_1.TraceFormat.formatPath(this.host.fileName)} (server version: ${newVersion})`);
        }
        else {
            this.host.trace.warning(`Attempted to overwrite history for ${traceSource_1.TraceFormat.formatPath(this.host.fileName)} with ${newVersion} (current: ${this.CurrentServerVersionNumber})`);
        }
    }
    TransformMessageToCurrent(message) {
        return this.TransformMessageToVersionWithMessageIndex(message, this.CurrentServerVersionNumber, this.serverVersionHistory.length);
    }
    static TrackForwardAcrossChange(position, changes) {
        return TransformManager.TrackForwardAcrossChangeWithAdjustment(position, new PositionAdjustment(), changes);
    }
    static TrackForwardAcrossChangeWithAdjustment(position, adjustment, changes) {
        let accumulatedDelta = 0;
        for (let i = 0; (i < changes.length); ++i) {
            let change = changes[i];
            if ((change.start + change.length >= position) && (i >= adjustment.nextChangeIndex)) {
                if (change.start < position) {
                    position = change.start + change.newText.length;
                }
                break;
            }
            accumulatedDelta += change.newText.length - change.length;
        }
        position += accumulatedDelta + adjustment.offset;
        return position;
    }
    static TrackBackwardAcrossChange(position, changes) {
        return TransformManager.TrackBackwardAcrossChangeWithAdjustment(position, new PositionAdjustment(), changes);
    }
    static TrackBackwardAcrossChangeWithAdjustment(position, adjustment, changes) {
        adjustment.offset = 0;
        adjustment.nextChangeIndex = -1;
        while (++adjustment.nextChangeIndex < changes.length) {
            let change = changes[adjustment.nextChangeIndex];
            if (change.start + change.newText.length >= position) {
                if (change.start < position) {
                    adjustment.offset = (position - change.start);
                    position = change.start;
                }
                break;
            }
            position -= (change.newText.length - change.length);
        }
        return position;
    }
    TransformMessageIndexToVersion(targetVersion, messageIndex) {
        let message = this.serverVersionHistory[messageIndex].GetBestMessage(targetVersion);
        if (message.changeServerVersion === targetVersion) {
            return message;
        }
        let newMessage = this.TransformMessageToVersionWithMessageIndex(message, targetVersion, messageIndex);
        this.serverVersionHistory[messageIndex].AddMessage(newMessage);
        return newMessage;
    }
    TransformMessageToVersionWithMessageIndex(message, targetVersion, messageIndex) {
        coeditingUtils_1.assert(message !== null, 'message must not be null');
        coeditingUtils_1.assert(targetVersion >= message.changeServerVersion, `Can\'t translate messages to prior to their creation. Target: ${targetVersion}, Message: ${message.changeServerVersion}`);
        if (message === null || targetVersion < message.changeServerVersion) {
            return;
        }
        // Take messages, whose changes are defined on message.ChangeServerVersion and roll those changes forward to the specified targetVersion
        // (where int.MaxValue corresponds to latest).
        //
        // The first step is to find the server versions that are relevant to transforming this message.
        // Note we're only interested in server versions after the server version of the message (the message does not need to be transformed
        // with respect to that) and the message before the target version (we don't need to transform for that message either).
        let serverVersionLastIndex = this.serverVersionHistory.length - 1;
        for (let serverVersionIndex = serverVersionLastIndex; (serverVersionIndex >= 0); --serverVersionIndex) {
            let serverVersion = this.serverVersionHistory[serverVersionIndex];
            if (serverVersion.serverVersionNumber === targetVersion) {
                serverVersionLastIndex = serverVersionIndex;
                break;
            }
        }
        let anyRemoteChanges = false;
        let serverVersionStartIndex = serverVersionLastIndex + 1;
        for (let serverVersionIndex = serverVersionLastIndex; (serverVersionIndex >= 0); --serverVersionIndex) {
            let serverVersion = this.serverVersionHistory[serverVersionIndex];
            if (serverVersion.serverVersionNumber === message.changeServerVersion) {
                // We only need to account for changes made after we match up the version numbers.
                serverVersionStartIndex = serverVersionIndex + 1;
                break;
            }
            anyRemoteChanges = anyRemoteChanges || (serverVersion.Message.clientId !== message.clientId);
        }
        if (serverVersionStartIndex > serverVersionLastIndex) {
            // No need to transform anything
            return message;
        }
        else if (!anyRemoteChanges) {
            // All of the changes we'd translate across are from the sender of the message so
            // the message is, effectively, already translated to the desired version.
            return coauthoringService_1.MessageFactory.TextChangeMessage(message.clientId, message.fileName, targetVersion, message.changes);
        }
        // Make a copy of the changes in the message so that we don't corrupt the original message.
        let copyOfChanges = [];
        for (let i = 0; (i < message.changes.length); ++i) {
            let messageChange = message.changes[i];
            copyOfChanges.push(coauthoringService_1.MessageFactory.TextChange(messageChange.start, messageChange.length, messageChange.newText));
        }
        let spanAdjustments = null;
        // Look for changes made by the same client in the interesting parts of the server history
        // and roll this change back across those changes (preserving the information in spanOffsets to
        // restore the positions later)
        let maxServerVersionIndex = (messageIndex > serverVersionLastIndex)
            ? (messageIndex - 1)
            : serverVersionLastIndex;
        for (let serverVersionIndex = maxServerVersionIndex; (serverVersionIndex >= serverVersionStartIndex); --serverVersionIndex) {
            let serverVersion = this.serverVersionHistory[serverVersionIndex];
            if (serverVersion.Message.clientId === message.clientId) {
                if (spanAdjustments === null) {
                    spanAdjustments = [];
                    for (let i = 0; (i < this.serverVersionHistory.length); ++i) {
                        spanAdjustments.push([]);
                        for (let j = 0; (j < copyOfChanges.length); ++j)
                            spanAdjustments[i][j] = new SpanAdjustment();
                    }
                }
                let transformedMessage = this.TransformMessageIndexToVersion(message.changeServerVersion, serverVersionIndex);
                for (let changeIndex = 0; (changeIndex < copyOfChanges.length); ++changeIndex) {
                    let change = copyOfChanges[changeIndex];
                    let start = TransformManager.TrackBackwardAcrossChangeWithAdjustment(change.start, spanAdjustments[serverVersionIndex][changeIndex].start, transformedMessage.changes);
                    let end = TransformManager.TrackBackwardAcrossChangeWithAdjustment(change.start + change.length, spanAdjustments[serverVersionIndex][changeIndex].end, transformedMessage.changes);
                    coeditingUtils_1.assert(start >= 0, 'start must be positive');
                    coeditingUtils_1.assert(end >= start, 'end must not come before start');
                    change.start = start;
                    change.length = end - start;
                }
            }
        }
        let currentVersion = message.changeServerVersion;
        for (let serverVersionIndex = serverVersionStartIndex; (serverVersionIndex <= maxServerVersionIndex); ++serverVersionIndex) {
            let serverVersion = this.serverVersionHistory[serverVersionIndex];
            if ((serverVersionIndex <= serverVersionLastIndex) || (serverVersion.Message.clientId === message.clientId)) {
                let transformedMessage = this.TransformMessageIndexToVersion(currentVersion, serverVersionIndex);
                for (let changeIndex = 0; (changeIndex < copyOfChanges.length); ++changeIndex) {
                    let change = copyOfChanges[changeIndex];
                    // Translate the change from the server version it is on to the current state.
                    // Track each each change as a distinct change rather that simply translating from the server version to now
                    // since there may be extraneous changes between here (see the unacknowledgedChanges handling above and below)
                    // that could confuse things.
                    let start = change.start;
                    let end = change.start + change.length;
                    if (spanAdjustments === null) {
                        start = TransformManager.TrackForwardAcrossChange(start, transformedMessage.changes);
                        end = TransformManager.TrackForwardAcrossChange(end, transformedMessage.changes);
                    }
                    else {
                        start = TransformManager.TrackForwardAcrossChangeWithAdjustment(start, spanAdjustments[serverVersionIndex][changeIndex].start, transformedMessage.changes);
                        end = TransformManager.TrackForwardAcrossChangeWithAdjustment(end, spanAdjustments[serverVersionIndex][changeIndex].end, transformedMessage.changes);
                    }
                    coeditingUtils_1.assert(start >= 0, 'start must be positive');
                    coeditingUtils_1.assert(end >= start, 'end must not come before start');
                    change.start = start;
                    change.length = end - start;
                }
                if (serverVersionIndex <= serverVersionLastIndex) {
                    currentVersion = serverVersion.serverVersionNumber;
                }
            }
        }
        let m = coauthoringService_1.MessageFactory.TextChangeMessage(message.clientId, message.fileName, currentVersion, copyOfChanges);
        return m;
    }
}
exports.TransformManager = TransformManager;
class SpanAdjustment {
    constructor() {
        this.start = new PositionAdjustment();
        this.end = new PositionAdjustment();
    }
}
class PositionAdjustment {
    constructor() {
        this.offset = 0;
        this.nextChangeIndex = 0;
    }
}
class ServerVersion {
    constructor(serverVersionNumber, message) {
        this.serverVersionNumber = serverVersionNumber;
        this.messages = [];
        if (Array.isArray(message)) {
            this.messages = message;
        }
        else {
            this.messages.push(message);
        }
    }
    get Message() {
        return this.messages[0];
    }
    clone() {
        const clonedMessages = this.messages.map((msg) => {
            if (!msg) {
                // Version -1 always has a null message
                return msg;
            }
            return coauthoringService_1.MessageFactory.CoauthoringMessage(msg);
        });
        const result = new ServerVersion(this.serverVersionNumber, clonedMessages);
        return result;
    }
    GetBestMessage(changeServerVersion) {
        for (let i = this.messages.length - 1; (i >= 0); --i) {
            let message = this.messages[i];
            if (message.changeServerVersion <= changeServerVersion) {
                return message;
            }
        }
        return this.messages[0];
    }
    AddMessage(message) {
        for (let i = this.messages.length - 1; (i >= 0); --i) {
            let existingMessage = this.messages[i];
            if (message.changeServerVersion >= existingMessage.changeServerVersion) {
                coeditingUtils_1.assert(message.changeServerVersion !== existingMessage.changeServerVersion, 'Should never try to insert a message we have');
                coeditingUtils_1.assert(message.clientId === existingMessage.clientId, 'Client IDs should never change');
                this.messages.splice(i + 1, 0, message);
                return;
            }
        }
        coeditingUtils_1.assert(false, 'Never should try to insert a new version before index 0');
    }
}
exports.ServerVersion = ServerVersion;

//# sourceMappingURL=TransformManager.js.map
