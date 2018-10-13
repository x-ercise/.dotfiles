"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const traceSource_1 = require("../tracing/traceSource");
const pathManager_1 = require("../languageService/pathManager");
class BreakpointManager {
    constructor(isSharing, sourceEventService) {
        this.isSharing = isSharing;
        this.sourceEventService = sourceEventService;
        this.pathManager = pathManager_1.PathManager.getPathManager();
        this.onDidChangeBreakpoints = async (eventData) => {
            if (this.ignoreChangeBreakpoints) {
                // ignore this local changes since we probably know we are causing it
                return;
            }
            let collabBreakpointsChanged = false;
            if (eventData.added.length > 0) {
                const breakpointsAdded = this.toSourceBreakpoints(eventData.added);
                this.logBreakpoints('Local breakpoints added:', breakpointsAdded);
                if (breakpointsAdded.length > 0) {
                    collabBreakpointsChanged = true;
                    await this.sourceEventService.fireEventAsync(BreakpointManager.debugBreakpointsAddId, BreakpointManager.toJson(breakpointsAdded));
                }
            }
            else if (eventData.removed.length > 0) {
                const breakpointsRemoved = this.toSourceBreakpoints(eventData.removed);
                this.logBreakpoints('Local breakpoints removed:', breakpointsRemoved);
                if (breakpointsRemoved.length > 0) {
                    collabBreakpointsChanged = true;
                    await this.sourceEventService.fireEventAsync(BreakpointManager.debugBreakpointsRemoveId, BreakpointManager.toJson(breakpointsRemoved));
                }
            }
            else if (eventData.changed.length > 0) {
                const breakpointsChanged = this.toSourceBreakpoints(eventData.changed);
                this.logBreakpoints('Local breakpoints changed:', breakpointsChanged);
                if (breakpointsChanged.length > 0) {
                    collabBreakpointsChanged = true;
                    await this.sourceEventService.fireEventAsync(BreakpointManager.debugBreakpointsChangeId, BreakpointManager.toJson(breakpointsChanged));
                }
            }
            if (this.isSharing && collabBreakpointsChanged) {
                await this.updateCollaborationBreakpoints();
            }
        };
        this.onSourceEvent = async (eventData) => {
            let breakpointsChanged = false;
            if (eventData.sourceId === BreakpointManager.debugBreakpointsAddId) {
                const breakpointsAdded = BreakpointManager.toBreakpoints(eventData.jsonContent);
                this.logBreakpoints('Remote breakpoints added:', breakpointsAdded);
                const vscodeBkpts = this.toVSCodeBreakpoints(breakpointsAdded);
                if (vscodeBkpts.length > 0) {
                    breakpointsChanged = this.addLocalBreakpoints(vscodeBkpts);
                }
            }
            else if (eventData.sourceId === BreakpointManager.debugBreakpointsRemoveId) {
                const breakpointsRemoved = BreakpointManager.toBreakpoints(eventData.jsonContent);
                this.logBreakpoints('Remote breakpoints removed:', breakpointsRemoved);
                const vscodeBkpts = this.toVSCodeBreakpoints(breakpointsRemoved);
                if (vscodeBkpts.length > 0) {
                    breakpointsChanged = this.removeLocalBreakpoints(vscodeBkpts);
                }
            }
            else if (eventData.sourceId === BreakpointManager.debugBreakpointsChangeId) {
                const breakpointsUpdated = BreakpointManager.toBreakpoints(eventData.jsonContent);
                this.logBreakpoints('Remote breakpoints updated:', breakpointsUpdated);
                const vscodeBkpts = this.toVSCodeBreakpoints(breakpointsUpdated);
                if (vscodeBkpts.length > 0) {
                    breakpointsChanged = this.updateLocalBreakpoints(vscodeBkpts);
                }
            }
            if (this.isSharing && breakpointsChanged) {
                await this.updateCollaborationBreakpoints();
            }
        };
        // Create our trace source
        this.trace = traceSource_1.traceSource.withName(traceSource_1.TraceSources.BreakpointManager);
        this.sourceEventService.onEvent(this.onSourceEvent);
        // start event subscription
        this.onDidChangeBreakpointsEvt = vscode.debug.onDidChangeBreakpoints(this.onDidChangeBreakpoints, this);
    }
    static hasVSCodeSupport() {
        return typeof vscode.debug.addBreakpoints === 'function';
    }
    async initialize() {
        this.trace.verbose('initialize');
        if (this.isSharing) {
            // for sharing ensure we define the workspace breakpoints
            await this.updateCollaborationBreakpoints();
        }
        else {
            // when joining grab the collaboration breakpoints
            const breakpoints = await this.getCollaborationBreakpoints();
            const vscodeBkpts = this.toVSCodeBreakpoints(breakpoints);
            // remove first and then add the existing collaboration breakpoints
            this.removeLocalBreakpoints(vscode.debug.breakpoints);
            this.addLocalBreakpoints(vscodeBkpts);
        }
    }
    async dispose() {
        this.onDidChangeBreakpointsEvt.dispose();
    }
    addLocalBreakpoints(bkpts) {
        bkpts = bkpts.filter(bkpt => {
            return 'location' in bkpt && !this.sourceBreakpointExists(bkpt);
        });
        if (bkpts.length > 0) {
            bkpts.forEach(bkpt => {
                const srcBkpt = bkpt;
                this.trace.verbose(`addBreakpoint srcBkpt uri:${srcBkpt.location.uri.path} line:${srcBkpt.location.range.start.line} character:${srcBkpt.location.range.start.character}`);
            });
            try {
                this.ignoreChangeBreakpoints = true;
                vscode.debug.addBreakpoints(bkpts);
            }
            finally {
                this.ignoreChangeBreakpoints = false;
            }
            return true;
        }
        return false;
    }
    removeLocalBreakpoints(bkpts) {
        bkpts = bkpts.map(bkpt => {
            return 'location' in bkpt && this.findSourceBreakpoint(bkpt);
        });
        if (bkpts.length > 0) {
            bkpts.forEach(bkpt => {
                const srcBkpt = bkpt;
                this.trace.verbose(`removeBreakpoint srcBkpt uri:${srcBkpt.location.uri.path} line:${srcBkpt.location.range.start.line} character:${srcBkpt.location.range.start.character}`);
            });
            try {
                this.ignoreChangeBreakpoints = true;
                vscode.debug.removeBreakpoints(bkpts);
            }
            finally {
                this.ignoreChangeBreakpoints = false;
            }
            return true;
        }
        return false;
    }
    // Update the enabled, condition and hit condition properties of local breakpoints
    updateLocalBreakpoints(bkpts) {
        // Filter the list of local breakpoints that need to be updated to only those
        // where the enabled, condition or hit condition properties have been modified.
        bkpts = bkpts.filter(bkpt => {
            if (!('location' in bkpt)) {
                return false;
            }
            const srcBkpt = bkpt;
            const currentBkpt = this.findSourceBreakpoint(srcBkpt);
            return currentBkpt &&
                (currentBkpt.enabled !== srcBkpt.enabled ||
                    currentBkpt.condition !== srcBkpt.condition ||
                    currentBkpt.hitCondition !== srcBkpt.hitCondition);
        });
        // First attempt to remove the local breakpoints that should be updated.
        // If this succeeds then add the breakpoints with the updated properties.
        // Else return false to indicate no local breakpoints were updated.
        return this.removeLocalBreakpoints(bkpts) ? this.addLocalBreakpoints(bkpts) : false;
    }
    // Update the collaboration breakpoints when in sharing mode
    async updateCollaborationBreakpoints() {
        const breakpoints = this.getCurrentBreakpoints();
        this.trace.verbose(`updateCollaborationBreakpoints total:${breakpoints.length}`);
        await this.sourceEventService.setSourceDataAsync(BreakpointManager.debugBreakpointsSourceId, BreakpointManager.toJson(breakpoints), false);
    }
    // Return the existing collaboration breakpoints from the sharer session
    async getCollaborationBreakpoints() {
        const json = await this.sourceEventService.getSourceDataAsync(BreakpointManager.debugBreakpointsSourceId);
        return BreakpointManager.toBreakpoints(json);
    }
    // Return the current breakpoints from this opened workspace
    getCurrentBreakpoints() {
        return this.toSourceBreakpoints(vscode.debug.breakpoints);
    }
    logBreakpoints(message, breakpoints) {
        let logMsg = undefined;
        breakpoints.forEach(async (bkpt) => {
            if (!logMsg) {
                logMsg = message;
            }
            logMsg += '\n' + BreakpointManager.toString(bkpt);
        });
        if (logMsg) {
            this.trace.verbose(logMsg);
        }
    }
    toSourceBreakpoints(bkpts) {
        return bkpts.filter(b => this.isLiveShareSourceBreakpoint(b)).map(b => this.toBreakpoint(b));
    }
    static toString(bkpt) {
        return `Path:${bkpt.source.path} Line:${bkpt.line} Column:${bkpt.column} EndColumn:${bkpt.endColumn}`;
    }
    static toBreakpoints(json) {
        if (!json) {
            return [];
        }
        return JSON.parse(json);
    }
    static toJson(bkpts) {
        return JSON.stringify(bkpts);
    }
    // Find the an instance of a source breakpoint in the existing catalog
    findSourceBreakpoint(srcBkpt) {
        return vscode.debug.breakpoints.find(bkpt => {
            if (!('location' in bkpt)) {
                // not a valid breakpoint 
                return false;
            }
            const itemSrcBkpt = bkpt;
            // Compare using the full URI as string, as non-file URIs fsPath
            // is weird and potentially inconsistent.
            const sameFile = itemSrcBkpt.location.uri.toString() === srcBkpt.location.uri.toString();
            const sameLine = itemSrcBkpt.location.range.start.line === srcBkpt.location.range.start.line;
            return sameFile && sameLine;
        });
    }
    sourceBreakpointExists(srcBkpt) {
        return this.findSourceBreakpoint(srcBkpt) !== undefined;
    }
    // Convert a VSCode breakpoint into a debug protocol breakpoint instance
    toBreakpoint(srcBkpt) {
        const locationUri = srcBkpt.location.uri;
        const sourcePath = this.pathManager.localPathToRelativePath(locationUri);
        const source = {
            path: sourcePath,
        };
        const bkpt = {
            condition: srcBkpt.condition,
            enabled: srcBkpt.enabled,
            hitCondition: srcBkpt.hitCondition,
            verified: false,
            source: source,
            line: srcBkpt.location.range.start.line + 1,
            column: srcBkpt.location.range.start.character + 1,
            endLine: srcBkpt.location.range.end.line + 1,
            endColumn: srcBkpt.location.range.end.character + 1,
        };
        return bkpt;
    }
    // Convert a collaboration breakpoint into a vscode compatible breakpoint
    toVSCodeBreakpoint(bkpt) {
        const uri = this.pathManager.relativePathToLocalPath(bkpt.source.path);
        // Note: we will use only line/column to locate a breakpoint
        const startPos = BreakpointManager.toVSCodePosition(bkpt.line, null /*bkpt.column*/);
        const endPos = BreakpointManager.toVSCodePosition(bkpt.line, bkpt.column);
        const location = new vscode.Location(uri, new vscode.Range(startPos, startPos));
        const hitCondition = parseInt(bkpt.hitCondition, 10) ? bkpt.hitCondition : undefined;
        return new vscode.SourceBreakpoint(location, bkpt.enabled, bkpt.condition, hitCondition);
    }
    toVSCodeBreakpoints(bkpts) {
        return bkpts.map(b => this.toVSCodeBreakpoint(b));
    }
    // ensure the breakpoint is a 'Source' breakpoint and also contained on our shared workspace
    isLiveShareSourceBreakpoint(bkpt) {
        if (!('location' in bkpt)) {
            return false;
        }
        // If the location is inside any of the IDEs workspaces, it's something
        // we can manage. This API accounts for protocols, file systems etc.
        const locationUri = bkpt.location.uri;
        return !!vscode.workspace.getWorkspaceFolder(locationUri);
    }
    static toVSCodePosition(start, end) {
        return new vscode.Position(start ? start - 1 : 0, end ? end - 1 : 0);
    }
}
BreakpointManager.debugBreakpointsSourceId = 'debugBreakpoints';
BreakpointManager.debugBreakpointsAddId = 'debugBreakpointsAdd';
BreakpointManager.debugBreakpointsRemoveId = 'debugBreakpointsRemove';
BreakpointManager.debugBreakpointsChangeId = 'debugBreakpointsChange';
exports.BreakpointManager = BreakpointManager;

//# sourceMappingURL=breakpointManager.js.map
