"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const collaborators_1 = require("../../workspace/collaborators");
const telemetryStrings_1 = require("../../telemetry/telemetryStrings");
class GuestTrackerManager {
    constructor(sessionContext, telemetry, notificationUtil, browserUtil, trace) {
        this.sessionContext = sessionContext;
        this.telemetry = telemetry;
        this.notificationUtil = notificationUtil;
        this.browserUtil = browserUtil;
        this.trace = trace;
        this.alreadyDisposed = false;
        this.peopleDidJoin = false;
        this.registerUser = () => {
            this.peopleDidJoin = true;
        };
    }
    shouldShow() {
        //return !this.peopleDidJoin;
        // Disabling for the time being
        return false;
    }
    async init() {
        this.alreadyDisposed = false;
        this.sessionContext.addListener(collaborators_1.CollaboratorManager.collaboratorsChangedEvent, this.registerUser);
        this.telemetryEvent = this.telemetry.startTimedEvent(telemetryStrings_1.TelemetryEventNames.ZEROUSER_SESSION);
    }
    async dispose() {
        this.sessionContext.removeListener(collaborators_1.CollaboratorManager.collaboratorsChangedEvent, this.registerUser);
        const shouldShow = this.shouldShow();
        if (!this.alreadyDisposed && shouldShow) {
            try {
                await this.showNotification(this.telemetryEvent);
            }
            catch (e) {
                this.trace.error('Error in disposing `GuestTrackerManager`: ' + e);
            }
        }
        this.alreadyDisposed = true;
        this.peopleDidJoin = false;
        this.telemetryEvent = null;
    }
    async showNotification(telemetryEvent) {
        const options = {
            placeHolder: 'Did your Live Share collaboration session work well?',
            ignoreFocusOut: false,
        };
        const values = [
            { label: 'Yep!', description: 'I’m just testing it out, and plan to use it again.', id: 1 },
            { label: 'Nope!', description: 'No guests were able to successfully join.', id: 2 },
            { label: 'Nope!', description: 'I wasn’t sure what to do after sharing.', id: 3 },
            { label: 'Nope!', description: 'I ran into an issue and would like to report it', id: 4 }
        ];
        const result = await this.notificationUtil.showQuickPick(values, options);
        const reason = result ? `${result.label} ${result.description}` : 'Ignored';
        telemetryEvent.addProperty(telemetryStrings_1.TelemetryPropertyNames.ZEROUSER_SESSION_REASON, reason);
        telemetryEvent.send();
        if (result.id === GuestTrackerManager.OTHER_ID) {
            this.browserUtil.openBrowser('http://aka.ms/vsls/share-issue');
        }
    }
}
GuestTrackerManager.OTHER_ID = 4;
exports.GuestTrackerManager = GuestTrackerManager;

//# sourceMappingURL=GuestTrackerManager.js.map
