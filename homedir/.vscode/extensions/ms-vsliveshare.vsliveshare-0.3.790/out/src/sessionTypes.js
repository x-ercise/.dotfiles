"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var SessionState;
(function (SessionState) {
    SessionState[SessionState["Initializing"] = 0] = "Initializing";
    SessionState[SessionState["SignedOut"] = 1] = "SignedOut";
    SessionState[SessionState["SigningIn"] = 2] = "SigningIn";
    SessionState[SessionState["ExternallySigningIn"] = 3] = "ExternallySigningIn";
    SessionState[SessionState["SignedIn"] = 4] = "SignedIn";
    SessionState[SessionState["SharingInProgress"] = 5] = "SharingInProgress";
    SessionState[SessionState["Shared"] = 6] = "Shared";
    SessionState[SessionState["JoiningInProgress"] = 7] = "JoiningInProgress";
    SessionState[SessionState["Joined"] = 8] = "Joined";
})(SessionState = exports.SessionState || (exports.SessionState = {}));
var SessionEvents;
(function (SessionEvents) {
    SessionEvents["StateChanged"] = "StateChanged";
    SessionEvents["StatusChanged"] = "StatusChanged";
    SessionEvents["CollaboratorsChanged"] = "CollaboratorsChanged";
    SessionEvents["HasCollaboratorsChanged"] = "HasCollaboratorsChanged";
    SessionEvents["ReadOnlyChanged"] = "ReadOnlyChanged";
})(SessionEvents = exports.SessionEvents || (exports.SessionEvents = {}));

//# sourceMappingURL=sessionTypes.js.map
