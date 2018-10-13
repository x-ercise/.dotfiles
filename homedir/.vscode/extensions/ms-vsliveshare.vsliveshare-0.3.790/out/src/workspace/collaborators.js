"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vsls = require("../contracts/VSLS");
const session_1 = require("../session");
const events = require("events");
class CollaboratorManager extends events.EventEmitter {
    constructor(collaboratorProfiles) {
        super();
        this.coEditorsHistory = {}; // Hashset of all session numbers that were co-editors
        this.coEditors = {}; // Hashset of session numbers that are co-editors and currently connected
        this.coEditorsIDE = {}; // Hashset of session numbers and the IDE of these sessions
        this.coEditorCount = 0;
        this.profiles = {};
        this.localUserInfo = session_1.SessionContext.userInfo;
        this.profiles = collaboratorProfiles || {};
    }
    onWorkspaceSessionChanged(e) {
        if (e.changeType === vsls.WorkspaceSessionChangeType.Joined) {
            this.profiles[e.sessionNumber] = e.userProfile;
            this.coEditorsIDE[e.sessionNumber] = e.applicationName;
        }
        else if (e.changeType === vsls.WorkspaceSessionChangeType.Unjoined) {
            delete this.coEditors[e.sessionNumber];
            delete this.profiles[e.sessionNumber];
            if (this.coEditorCount > 0) {
                --this.coEditorCount;
            }
        }
        if (this.coEditorCount <= 0) {
            session_1.SessionContext.HasCollaborators = false;
        }
        this.emit(CollaboratorManager.collaboratorsChangedEvent);
    }
    getDisplayName(sessionId) {
        const profile = this.profiles[sessionId];
        if (profile) {
            return profile.name || profile.email;
        }
        if (session_1.SessionContext.coeditingClient && sessionId === session_1.SessionContext.coeditingClient.clientID) {
            return this.localUserInfo.displayName || this.localUserInfo.emailAddress;
        }
        // Unknown user profile. Return default value.
        return `Collaborator ${sessionId}`;
    }
    getEmail(sessionId) {
        const profile = this.profiles[sessionId];
        if (profile) {
            return profile.email || '';
        }
    }
    /**
     * Returns all IDEs used by participants in this session
     */
    getIDEs() {
        return new Set(this.getCollaboratorSessionIds().map(sessionId => this.coEditorsIDE[sessionId]));
    }
    /**
     * Returns the number of remote collaborators in this session (excludes the local user).
     */
    getCollaboratorCount() {
        return this.coEditorCount;
    }
    getCollaboratorCountByIDE(ide) {
        return this.getCollaboratorEmailsByIDE(ide).length;
    }
    /**
     * Returns the number of distinct remote collaborators in this session (excludes the local user).
     */
    getDistinctCollaboratorCount() {
        return (new Set(this.getCollaboratorEmails())).size;
    }
    // If the host is joined as a guest, this will not count them as a distinct guest
    getDistinctCollaboratorCountByIDE(ide) {
        return (new Set(this.getCollaboratorEmailsByIDE(ide)
            .filter(email => email !== this.localUserInfo.emailAddress))).size;
    }
    /**
     * Returns the sessionId of all remote collaborators (excludes the local user).
     */
    getCollaboratorSessionIds() {
        return Object.keys(this.coEditors)
            .map((id) => parseInt(id, 10));
    }
    /**
     * Returns the display names of all remote collaborators (excludes the local user).
     */
    getCollaboratorEmails() {
        return this.getCollaboratorSessionIds().map(sessionId => this.getEmail(sessionId));
    }
    getCollaboratorEmailsByIDE(ide) {
        return this.getCollaboratorSessionIds().filter(sessionId => (this.coEditorsIDE[sessionId] === ide)).map(sessionId => this.getEmail(sessionId));
    }
    coEditorsJoined(joinerIds) {
        joinerIds.forEach((joinerId) => {
            if (joinerId !== session_1.SessionContext.coeditingClient.clientID) {
                this.coEditorsHistory[joinerId] = true;
                this.coEditors[joinerId] = true;
                ++this.coEditorCount;
            }
        });
        if (this.coEditorCount > 0) {
            session_1.SessionContext.HasCollaborators = true;
        }
        this.emit(CollaboratorManager.collaboratorsChangedEvent);
    }
    wasCoEditor(sessionNumber) {
        return typeof this.coEditorsHistory[sessionNumber] !== 'undefined';
    }
    getCollaborators() {
        return Object.assign({}, this.profiles);
    }
    dispose() {
        this.removeAllListeners();
        session_1.SessionContext.HasCollaborators = false;
    }
}
CollaboratorManager.collaboratorsChangedEvent = 'collaboratorsChanged';
exports.CollaboratorManager = CollaboratorManager;

//# sourceMappingURL=collaborators.js.map
