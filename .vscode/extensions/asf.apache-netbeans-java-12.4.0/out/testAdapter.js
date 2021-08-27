/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NbTestAdapter = void 0;
const vscode_1 = require("vscode");
const path = require("path");
class NbTestAdapter {
    constructor(workspaceFolder, client) {
        this.workspaceFolder = workspaceFolder;
        this.client = client;
        this.disposables = [];
        this.children = [];
        this.testsEmitter = new vscode_1.EventEmitter();
        this.statesEmitter = new vscode_1.EventEmitter();
        this.disposables.push(this.testsEmitter);
        this.disposables.push(this.statesEmitter);
        this.testSuite = { type: 'suite', id: '*', label: 'Tests', children: this.children };
    }
    get tests() {
        return this.testsEmitter.event;
    }
    get testStates() {
        return this.statesEmitter.event;
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.testsEmitter.fire({ type: 'started' });
            let clnt = yield this.client;
            console.log(clnt);
            this.children.length = 0;
            const loadedTests = yield vscode_1.commands.executeCommand('java.load.workspace.tests', this.workspaceFolder.uri.toString());
            if (loadedTests) {
                loadedTests.forEach((suite) => {
                    this.updateTests(suite);
                });
            }
            if (this.children.length > 0) {
                this.testsEmitter.fire({ type: 'finished', suite: this.testSuite });
            }
            else {
                this.testsEmitter.fire({ type: 'finished' });
            }
        });
    }
    run(tests) {
        return __awaiter(this, void 0, void 0, function* () {
            this.statesEmitter.fire({ type: 'started', tests });
            if (tests.length === 1) {
                if (tests[0] === '*') {
                    yield vscode_1.commands.executeCommand('java.run.test', this.workspaceFolder.uri.toString());
                    this.statesEmitter.fire({ type: 'finished' });
                }
                else {
                    const idx = tests[0].indexOf(':');
                    const suiteName = idx < 0 ? tests[0] : tests[0].slice(0, idx);
                    const current = this.children.find(s => s.id === suiteName);
                    if (current && current.file) {
                        const methodName = idx < 0 ? undefined : tests[0].slice(idx + 1);
                        if (methodName) {
                            yield vscode_1.commands.executeCommand('java.run.single', vscode_1.Uri.file(current.file).toString(), methodName);
                        }
                        else {
                            yield vscode_1.commands.executeCommand('java.run.single', vscode_1.Uri.file(current.file).toString());
                        }
                        this.statesEmitter.fire({ type: 'finished' });
                    }
                    else {
                        this.statesEmitter.fire({ type: 'finished', errorMessage: `Cannot find suite to run: ${tests[0]}` });
                    }
                }
            }
            else {
                this.statesEmitter.fire({ type: 'finished', errorMessage: 'Failed to run mutliple tests' });
            }
        });
    }
    debug(tests) {
        return __awaiter(this, void 0, void 0, function* () {
            this.statesEmitter.fire({ type: 'started', tests });
            if (tests.length === 1) {
                const idx = tests[0].indexOf(':');
                const suiteName = idx < 0 ? tests[0] : tests[0].slice(0, idx);
                const current = this.children.find(s => s.id === suiteName);
                if (current && current.file) {
                    const methodName = idx < 0 ? undefined : tests[0].slice(idx + 1);
                    if (methodName) {
                        yield vscode_1.commands.executeCommand('java.debug.single', vscode_1.Uri.file(current.file).toString(), methodName);
                    }
                    else {
                        yield vscode_1.commands.executeCommand('java.debug.single', vscode_1.Uri.file(current.file).toString());
                    }
                    this.statesEmitter.fire({ type: 'finished' });
                }
                else {
                    this.statesEmitter.fire({ type: 'finished', errorMessage: `Cannot find suite to debug: ${tests[0]}` });
                }
            }
            else {
                this.statesEmitter.fire({ type: 'finished', errorMessage: 'Failed to debug mutliple tests' });
            }
        });
    }
    cancel() {
        vscode_1.debug.stopDebugging();
    }
    dispose() {
        this.cancel();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }
    testProgress(suite) {
        switch (suite.state) {
            case 'loaded':
                if (this.updateTests(suite)) {
                    this.testsEmitter.fire({ type: 'finished', suite: this.testSuite });
                }
                break;
            case 'running':
                this.statesEmitter.fire({ type: 'suite', suite: suite.suiteName, state: suite.state });
                break;
            case 'completed':
            case 'errored':
                let errMessage;
                if (suite.tests) {
                    const currentSuite = this.children.find(s => s.id === suite.suiteName);
                    if (currentSuite) {
                        suite.tests.forEach(test => {
                            var _a;
                            let message;
                            let decorations;
                            if (test.stackTrace) {
                                message = test.stackTrace.join('\n');
                                const testFile = test.file ? (_a = vscode_1.Uri.parse(test.file)) === null || _a === void 0 ? void 0 : _a.path : undefined;
                                if (testFile) {
                                    const fileName = path.basename(testFile);
                                    const line = test.stackTrace.map(frame => {
                                        const info = frame.match(/^\s*at\s*\S*\((\S*):(\d*)\)$/);
                                        if (info && info.length >= 3 && info[1] === fileName) {
                                            return parseInt(info[2]);
                                        }
                                        return null;
                                    }).find(l => l);
                                    if (line) {
                                        decorations = [{ line: line - 1, message: test.stackTrace[0] }];
                                    }
                                }
                            }
                            let currentTest = currentSuite.children.find(ti => ti.id === test.id);
                            if (currentTest) {
                                this.statesEmitter.fire({ type: 'test', test: test.id, state: test.state, message, decorations });
                            }
                            else if (test.state !== 'passed' && message && !errMessage) {
                                suite.state = 'errored';
                                errMessage = message;
                            }
                        });
                    }
                }
                this.statesEmitter.fire({ type: 'suite', suite: suite.suiteName, state: suite.state, message: errMessage });
                break;
        }
    }
    updateTests(suite) {
        var _a, _b;
        let changed = false;
        const currentSuite = this.children.find(s => s.id === suite.suiteName);
        if (currentSuite) {
            const file = suite.file ? (_a = vscode_1.Uri.parse(suite.file)) === null || _a === void 0 ? void 0 : _a.path : undefined;
            if (file && currentSuite.file !== file) {
                currentSuite.file = file;
                changed = true;
            }
            if (suite.line && currentSuite.line !== suite.line) {
                currentSuite.line = suite.line;
                changed = true;
            }
            if (suite.tests) {
                const ids = new Set();
                suite.tests.forEach(test => {
                    var _a, _b;
                    ids.add(test.id);
                    let currentTest = currentSuite.children.find(ti => ti.id === test.id);
                    if (currentTest) {
                        const file = test.file ? (_a = vscode_1.Uri.parse(test.file)) === null || _a === void 0 ? void 0 : _a.path : undefined;
                        if (file && currentTest.file !== file) {
                            currentTest.file = file;
                            changed = true;
                        }
                        if (test.line && currentTest.line !== test.line) {
                            currentTest.line = test.line;
                            changed = true;
                        }
                    }
                    else {
                        currentSuite.children.push({ type: 'test', id: test.id, label: test.shortName, tooltip: test.fullName, file: test.file ? (_b = vscode_1.Uri.parse(test.file)) === null || _b === void 0 ? void 0 : _b.path : undefined, line: test.line });
                        changed = true;
                    }
                });
                if (currentSuite.children.length !== ids.size) {
                    currentSuite.children = currentSuite.children.filter(ti => ids.has(ti.id));
                    changed = true;
                }
            }
        }
        else {
            const children = suite.tests ? suite.tests.map(test => {
                var _a;
                return { type: 'test', id: test.id, label: test.shortName, tooltip: test.fullName, file: test.file ? (_a = vscode_1.Uri.parse(test.file)) === null || _a === void 0 ? void 0 : _a.path : undefined, line: test.line };
            }) : [];
            this.children.push({ type: 'suite', id: suite.suiteName, label: suite.suiteName, file: suite.file ? (_b = vscode_1.Uri.parse(suite.file)) === null || _b === void 0 ? void 0 : _b.path : undefined, line: suite.line, children });
            changed = true;
        }
        return changed;
    }
}
exports.NbTestAdapter = NbTestAdapter;
//# sourceMappingURL=testAdapter.js.map