"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//
//  Copyright (c) Microsoft Corporation. All rights reserved.
//
const VSLS_1 = require("../../contracts/VSLS");
class MessageAndVersionNumber {
    constructor(message, serverVersionNumber) {
        this.message = message;
        this.serverVersionNumber = serverVersionNumber;
    }
}
class MessageFactory {
    /**
     * Returns a new co-authoring message where the missing properties in the given message are populated with default values.
     * @param msg The message to process
     */
    static CoauthoringMessage(msg) {
        let deserializedMsg;
        switch (msg.messageType) {
            case VSLS_1.MessageType.FileOpenAcknowledge:
                const fileOpenAcknowledgeMsg = msg;
                deserializedMsg = MessageFactory.FileOpenAcknowledgeMessage(fileOpenAcknowledgeMsg.clientId, fileOpenAcknowledgeMsg.fileName, fileOpenAcknowledgeMsg.joinerId, fileOpenAcknowledgeMsg.savedVersionNumber, fileOpenAcknowledgeMsg.startServerVersionNumber, fileOpenAcknowledgeMsg.changes, fileOpenAcknowledgeMsg.fallbackText, fileOpenAcknowledgeMsg.history, fileOpenAcknowledgeMsg.isReadOnly, fileOpenAcknowledgeMsg.wasUnableToOpen);
                break;
            case VSLS_1.MessageType.FileOpenRequest:
                const fileOpenRequestMsg = msg;
                deserializedMsg = MessageFactory.FileOpenRequestMessage(fileOpenRequestMsg.clientId, fileOpenRequestMsg.fileName, fileOpenRequestMsg.hashCode, fileOpenRequestMsg.sendJumpTo);
                break;
            case VSLS_1.MessageType.FileRelease:
                const fileReleaseMsg = msg;
                deserializedMsg = MessageFactory.FileReleaseMessage(fileReleaseMsg.clientId, fileReleaseMsg.fileName);
                break;
            case VSLS_1.MessageType.JoinAcknowledge:
                const joinAcknowledgeMsg = msg;
                deserializedMsg = MessageFactory.JoinAcknowledgeMessage(joinAcknowledgeMsg.clientId, joinAcknowledgeMsg.joinerId, joinAcknowledgeMsg.clientIds, joinAcknowledgeMsg.files);
                break;
            case VSLS_1.MessageType.JoinRequest:
                const joinRequestMsg = msg;
                deserializedMsg = MessageFactory.JoinRequestMessage(joinRequestMsg.clientId);
                break;
            case VSLS_1.MessageType.SaveFile:
                const saveFileMsg = msg;
                deserializedMsg = MessageFactory.SaveFileMessage(saveFileMsg.clientId, saveFileMsg.fileName);
                break;
            case VSLS_1.MessageType.SelectionChange:
                const scMsg = msg;
                deserializedMsg = MessageFactory.SelectionChangeMessage(scMsg.clientId, scMsg.fileName, scMsg.serverVersionNumber, scMsg.start, scMsg.length, scMsg.isReversed, scMsg.forceJumpForClientId);
                break;
            case VSLS_1.MessageType.TextChange:
                const tcMsg = msg;
                const changes = tcMsg.changes && tcMsg.changes.map(c => MessageFactory.TextChange(c.start, c.length, c.newText));
                deserializedMsg = MessageFactory.TextChangeMessage(tcMsg.clientId, tcMsg.fileName, tcMsg.changeServerVersion, changes);
                break;
            case VSLS_1.MessageType.Summon:
                const sMsg = msg;
                deserializedMsg = MessageFactory.SummonMessage(sMsg.clientId);
                break;
            case VSLS_1.MessageType.LayoutScroll:
                const lsMsg = msg;
                deserializedMsg = MessageFactory.LayoutScrollMessage(lsMsg.clientId, lsMsg.fileName, lsMsg.serverVersionNumber, lsMsg.start, lsMsg.length);
                break;
            default:
                return msg;
        }
        deserializedMsg.sendId = msg.sendId;
        return deserializedMsg;
    }
    static SummonMessage(clientId) {
        const message = {
            messageType: VSLS_1.MessageType.Summon,
            clientId: clientId
        };
        return message;
    }
    static FileOpenAcknowledgeMessage(clientId, fileName, joinerId, savedVersionNumber, startServerVersionNumber, changes, fallbackText, history, isReadOnly, wasUnableToOpen) {
        // If you get an error after re-generating interfaces, make sure you set MessageBase.sendId to optional in coauthoringServiceTypes.ts.
        const message = {
            messageType: VSLS_1.MessageType.FileOpenAcknowledge,
            clientId: clientId || 0,
            fileName: fileName || '',
            joinerId: joinerId || 0,
            savedVersionNumber: savedVersionNumber || 0,
            startServerVersionNumber: startServerVersionNumber || 0,
            changes: changes || [],
            fallbackText: typeof fallbackText === 'string' ? fallbackText : null,
            history: history || [],
            isReadOnly: isReadOnly || false,
            wasUnableToOpen: wasUnableToOpen || false,
        };
        return message;
    }
    static FileOpenRequestMessage(clientId, fileName, hashCode, sendJumpTo) {
        // If you get an error after re-generating interfaces, make sure you set MessageBase.sendId to optional in coauthoringServiceTypes.ts.
        const message = {
            messageType: VSLS_1.MessageType.FileOpenRequest,
            clientId: clientId || 0,
            fileName: fileName || '',
            hashCode: hashCode || 0,
            sendJumpTo: sendJumpTo || false
        };
        return message;
    }
    static FileReleaseMessage(clientId, fileName) {
        // If you get an error after re-generating interfaces, make sure you set MessageBase.sendId to optional in coauthoringServiceTypes.ts.
        let message = {
            messageType: VSLS_1.MessageType.FileRelease,
            clientId: clientId || 0,
            fileName: fileName || ''
        };
        return message;
    }
    static JoinAcknowledgeMessage(clientId, joinerId, clientIds, files) {
        // If you get an error after re-generating interfaces, make sure you set MessageBase.sendId to optional in coauthoringServiceTypes.ts.
        let message = {
            messageType: VSLS_1.MessageType.JoinAcknowledge,
            clientId: clientId || 0,
            joinerId: joinerId || 0,
            clientIds: clientIds || [],
            files: files || []
        };
        return message;
    }
    static JoinRequestMessage(clientId) {
        // If you get an error after re-generating interfaces, make sure you set MessageBase.sendId to optional in coauthoringServiceTypes.ts.
        let message = {
            messageType: VSLS_1.MessageType.JoinRequest,
            clientId: clientId
        };
        return message;
    }
    static SaveFileMessage(clientId, fileName) {
        // If you get an error after re-generating interfaces, make sure you set MessageBase.sendId to optional in coauthoringServiceTypes.ts.
        let message = {
            messageType: VSLS_1.MessageType.SaveFile,
            clientId: clientId || 0,
            fileName: fileName || ''
        };
        return message;
    }
    static SelectionChangeMessage(clientId, fileName, serverVersion, start, length, isReversed, forceJumpForId) {
        // If you get an error after re-generating interfaces, make sure you set MessageBase.sendId to optional in coauthoringServiceTypes.ts.
        let message = {
            messageType: VSLS_1.MessageType.SelectionChange,
            clientId: clientId || 0,
            fileName: fileName || '',
            forceJumpForClientId: typeof forceJumpForId === 'undefined' ? -1 : forceJumpForId,
            isReversed: isReversed || false,
            length: length || 0,
            serverVersionNumber: serverVersion || 0,
            start: start || 0
        };
        return message;
    }
    static LayoutScrollMessage(clientId, fileName, serverVersion, start, length) {
        const message = {
            messageType: VSLS_1.MessageType.LayoutScroll,
            clientId: clientId || 0,
            fileName: fileName || '',
            serverVersionNumber: serverVersion || 0,
            start: start || 0,
            length: length || 0
        };
        return message;
    }
    static TextChangeMessage(clientId, fileName, changeServerVersion, changes) {
        // If you get an error after re-generating interfaces, make sure you set MessageBase.sendId to optional in coauthoringServiceTypes.ts.
        const message = {
            messageType: VSLS_1.MessageType.TextChange,
            changes: changes || [],
            changeServerVersion: changeServerVersion || 0,
            clientId: clientId || 0,
            fileName: fileName || ''
        };
        return message;
    }
    static TextChange(start, length, newText) {
        let textChange = {
            length: length || 0,
            newText: newText || '',
            start: start || 0
        };
        return textChange;
    }
}
exports.MessageFactory = MessageFactory;
function IsFileContentMessage(msg) {
    switch (msg.messageType) {
        case VSLS_1.MessageType.FileRelease:
        case VSLS_1.MessageType.SaveFile:
        case VSLS_1.MessageType.SelectionChange:
        case VSLS_1.MessageType.TextChange:
        case VSLS_1.MessageType.LayoutScroll:
            return true;
        // These are actually about getting to a state that you have a file open or file close
        // so they're not about manipulating the content of the file.
        case VSLS_1.MessageType.FileOpenAcknowledge:
        case VSLS_1.MessageType.FileOpenRequest:
        // These are obviously not file content related, since they're about joining
        case VSLS_1.MessageType.JoinAcknowledge:
        case VSLS_1.MessageType.JoinRequest:
        default:
            return false;
    }
}
exports.IsFileContentMessage = IsFileContentMessage;
class CoauthoringService {
}
CoauthoringService.SERVICE = 'Coauthoring';
exports.CoauthoringService = CoauthoringService;

//# sourceMappingURL=coauthoringService.js.map
