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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestProgressNotification = exports.InputBoxRequest = exports.QuickPickRequest = exports.StatusMessageRequest = void 0;
const vscode_languageclient_1 = require("vscode-languageclient");
var StatusMessageRequest;
(function (StatusMessageRequest) {
    StatusMessageRequest.type = new vscode_languageclient_1.NotificationType('window/showStatusBarMessage');
})(StatusMessageRequest = exports.StatusMessageRequest || (exports.StatusMessageRequest = {}));
;
var QuickPickRequest;
(function (QuickPickRequest) {
    QuickPickRequest.type = new vscode_languageclient_1.RequestType('window/showQuickPick');
})(QuickPickRequest = exports.QuickPickRequest || (exports.QuickPickRequest = {}));
var InputBoxRequest;
(function (InputBoxRequest) {
    InputBoxRequest.type = new vscode_languageclient_1.RequestType('window/showInputBox');
})(InputBoxRequest = exports.InputBoxRequest || (exports.InputBoxRequest = {}));
var TestProgressNotification;
(function (TestProgressNotification) {
    TestProgressNotification.type = new vscode_languageclient_1.NotificationType('window/notifyTestProgress');
})(TestProgressNotification = exports.TestProgressNotification || (exports.TestProgressNotification = {}));
;
//# sourceMappingURL=protocol.js.map