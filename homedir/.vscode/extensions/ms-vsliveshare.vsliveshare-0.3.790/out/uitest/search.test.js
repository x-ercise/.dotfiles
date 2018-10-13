"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var SearchTests_1;
const mocha_typescript_1 = require("mocha-typescript");
const uiTestSuite_1 = require("./uiTestSuite");
const VIEWLET = 'div[id="workbench.view.search"] .search-view';
let SearchTests = SearchTests_1 = class SearchTests extends uiTestSuite_1.UITestSuite {
    static before() { return uiTestSuite_1.UITestSuite.startSharing(SearchTests_1.mochaContext); }
    static after() { return uiTestSuite_1.UITestSuite.endSharing(SearchTests_1.mochaContext); }
    async searchText() {
        await this.guestWorkbench.search.openSearchViewlet();
        await this.guestWorkbench.search.searchFor('express');
        await this.guestWorkbench.search.waitForResultText('61 results in 8 files');
        await this.guestWindow.waitForTextContent(`${VIEWLET} .plain.match .findInFileMatch`, 'express');
    }
};
__decorate([
    mocha_typescript_1.test
], SearchTests.prototype, "searchText", null);
__decorate([
    mocha_typescript_1.context
], SearchTests, "mochaContext", void 0);
SearchTests = SearchTests_1 = __decorate([
    mocha_typescript_1.suite
], SearchTests);
exports.SearchTests = SearchTests;

//# sourceMappingURL=search.test.js.map
