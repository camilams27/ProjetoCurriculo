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
exports.deactivate = exports.activate = exports.findClusters = exports.enableConsoleLog = void 0;
const vscode_1 = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
const net = require("net");
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const vscode_test_adapter_api_1 = require("vscode-test-adapter-api");
const vscode_test_adapter_util_1 = require("vscode-test-adapter-util");
const launcher = require("./nbcode");
const testAdapter_1 = require("./testAdapter");
const protocol_1 = require("./protocol");
const API_VERSION = "1.0";
let client;
let testAdapterRegistrar;
let nbProcess = null;
let debugPort = -1;
let consoleLog = !!process.env['ENABLE_CONSOLE_LOG'];
function handleLog(log, msg) {
    log.appendLine(msg);
    if (consoleLog) {
        console.log(msg);
    }
}
function handleLogNoNL(log, msg) {
    log.append(msg);
    if (consoleLog) {
        process.stdout.write(msg);
    }
}
function enableConsoleLog() {
    consoleLog = true;
    console.log("enableConsoleLog");
}
exports.enableConsoleLog = enableConsoleLog;
function findClusters(myPath) {
    let clusters = [];
    for (let e of vscode.extensions.all) {
        if (e.extensionPath === myPath) {
            continue;
        }
        const dir = path.join(e.extensionPath, 'nbcode');
        if (!fs.existsSync(dir)) {
            continue;
        }
        const exists = fs.readdirSync(dir);
        for (let clusterName of exists) {
            let clusterPath = path.join(dir, clusterName);
            let clusterModules = path.join(clusterPath, 'config', 'Modules');
            if (!fs.existsSync(clusterModules)) {
                continue;
            }
            let perm = fs.statSync(clusterModules);
            if (perm.isDirectory()) {
                clusters.push(clusterPath);
            }
        }
    }
    return clusters;
}
exports.findClusters = findClusters;
function findJDK(onChange) {
    function find() {
        let nbJdk = vscode_1.workspace.getConfiguration('netbeans').get('jdkhome');
        if (nbJdk) {
            return nbJdk;
        }
        let javahome = vscode_1.workspace.getConfiguration('java').get('home');
        if (javahome) {
            return javahome;
        }
        let jdkHome = process.env.JDK_HOME;
        if (jdkHome) {
            return jdkHome;
        }
        let jHome = process.env.JAVA_HOME;
        if (jHome) {
            return jHome;
        }
        return null;
    }
    let currentJdk = find();
    let timeout = undefined;
    vscode_1.workspace.onDidChangeConfiguration(params => {
        if (timeout || (!params.affectsConfiguration('java') && !params.affectsConfiguration('netbeans'))) {
            return;
        }
        timeout = setTimeout(() => {
            timeout = undefined;
            let newJdk = find();
            if (newJdk !== currentJdk) {
                currentJdk = newJdk;
                onChange(currentJdk);
            }
        }, 0);
    });
    onChange(currentJdk);
}
function activate(context) {
    let log = vscode.window.createOutputChannel("Apache NetBeans Language Server");
    let conf = vscode_1.workspace.getConfiguration();
    if (conf.get("netbeans.conflict.check")) {
        let e = vscode.extensions.getExtension('redhat.java');
        function disablingFailed(reason) {
            handleLog(log, 'Disabling some services failed ' + reason);
        }
        if (e && vscode_1.workspace.name) {
            vscode.window.showInformationMessage(`redhat.java found at ${e.extensionPath} - Suppressing some services to not clash with Apache NetBeans Language Server.`);
            conf.update('java.completion.enabled', false, false).then(() => {
                vscode.window.showInformationMessage('Usage of only one Java extension is recommended. Certain services of redhat.java have been disabled. ');
                conf.update('java.debug.settings.enableRunDebugCodeLens', false, false).then(() => { }, disablingFailed);
                conf.update('java.test.editor.enableShortcuts', false, false).then(() => { }, disablingFailed);
            }, disablingFailed);
        }
    }
    // find acceptable JDK and launch the Java part
    findJDK((specifiedJDK) => {
        let currentClusters = findClusters(context.extensionPath).sort();
        context.subscriptions.push(vscode.extensions.onDidChange(() => {
            const newClusters = findClusters(context.extensionPath).sort();
            if (newClusters.length !== currentClusters.length || newClusters.find((value, index) => value !== currentClusters[index])) {
                currentClusters = newClusters;
                activateWithJDK(specifiedJDK, context, log, true);
            }
        }));
        activateWithJDK(specifiedJDK, context, log, true);
    });
    //register debugger:
    let configProvider = new NetBeansConfigurationProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('java8+', configProvider));
    let configNativeProvider = new NetBeansConfigurationNativeProvider();
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('nativeimage', configNativeProvider));
    let debugDescriptionFactory = new NetBeansDebugAdapterDescriptionFactory();
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('java8+', debugDescriptionFactory));
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('nativeimage', debugDescriptionFactory));
    // register commands
    context.subscriptions.push(vscode_1.commands.registerCommand('java.workspace.compile', () => {
        return vscode_1.window.withProgress({ location: vscode_1.ProgressLocation.Window }, p => {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                let c = yield client;
                const commands = yield vscode.commands.getCommands();
                if (commands.includes('java.build.workspace')) {
                    p.report({ message: 'Compiling workspace...' });
                    c.outputChannel.show(true);
                    const start = new Date().getTime();
                    handleLog(log, `starting java.build.workspace`);
                    const res = yield vscode.commands.executeCommand('java.build.workspace');
                    const elapsed = new Date().getTime() - start;
                    handleLog(log, `finished java.build.workspace in ${elapsed} ms with result ${res}`);
                    const humanVisibleDelay = elapsed < 1000 ? 1000 : 0;
                    setTimeout(() => {
                        if (res) {
                            resolve(res);
                        }
                        else {
                            reject(res);
                        }
                    }, humanVisibleDelay);
                }
                else {
                    reject(`cannot compile workspace; client is ${c}`);
                }
            }));
        });
    }));
    context.subscriptions.push(vscode_1.commands.registerCommand('java.goto.super.implementation', () => __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (((_a = vscode_1.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document.languageId) !== "java") {
            return;
        }
        const uri = vscode_1.window.activeTextEditor.document.uri;
        const position = vscode_1.window.activeTextEditor.selection.active;
        const locations = (yield vscode.commands.executeCommand('java.super.implementation', uri.toString(), position)) || [];
        return vscode.commands.executeCommand('editor.action.goToLocations', vscode_1.window.activeTextEditor.document.uri, position, locations.map(location => new vscode.Location(vscode.Uri.parse(location.uri), new vscode.Range(location.range.start.line, location.range.start.character, location.range.end.line, location.range.end.character))), 'peek', 'No super implementation found');
    })));
    context.subscriptions.push(vscode_1.commands.registerCommand('java.rename.element.at', (offset) => __awaiter(this, void 0, void 0, function* () {
        const editor = vscode_1.window.activeTextEditor;
        if (editor) {
            yield vscode_1.commands.executeCommand('editor.action.rename', [
                editor.document.uri,
                editor.document.positionAt(offset),
            ]);
        }
    })));
    const runDebug = (noDebug, testRun, uri, methodName) => __awaiter(this, void 0, void 0, function* () {
        var _b;
        const docUri = uri ? vscode.Uri.file(uri) : (_b = vscode_1.window.activeTextEditor) === null || _b === void 0 ? void 0 : _b.document.uri;
        if (docUri) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(docUri);
            const debugConfig = {
                type: "java8+",
                name: "Java Single Debug",
                request: "launch",
                mainClass: uri,
                methodName,
                testRun
            };
            const debugOptions = {
                noDebug: noDebug,
            };
            const ret = yield vscode.debug.startDebugging(workspaceFolder, debugConfig, debugOptions);
            return ret ? new Promise((resolve) => {
                const listener = vscode.debug.onDidTerminateDebugSession(() => {
                    listener.dispose();
                    resolve(true);
                });
            }) : ret;
        }
    });
    context.subscriptions.push(vscode_1.commands.registerCommand('java.run.test', (uri, methodName) => __awaiter(this, void 0, void 0, function* () {
        yield runDebug(true, true, uri, methodName);
    })));
    context.subscriptions.push(vscode_1.commands.registerCommand('java.run.single', (uri, methodName) => __awaiter(this, void 0, void 0, function* () {
        yield runDebug(true, false, uri, methodName);
    })));
    context.subscriptions.push(vscode_1.commands.registerCommand('java.debug.single', (uri, methodName) => __awaiter(this, void 0, void 0, function* () {
        yield runDebug(false, false, uri, methodName);
    })));
    // get the Test Explorer extension and register TestAdapter
    const testExplorerExtension = vscode.extensions.getExtension(vscode_test_adapter_api_1.testExplorerExtensionId);
    if (testExplorerExtension) {
        const testHub = testExplorerExtension.exports;
        testAdapterRegistrar = new vscode_test_adapter_util_1.TestAdapterRegistrar(testHub, workspaceFolder => new testAdapter_1.NbTestAdapter(workspaceFolder, client));
        context.subscriptions.push(testAdapterRegistrar);
    }
    return Object.freeze({
        version: API_VERSION
    });
}
exports.activate = activate;
/**
 * Pending maintenance (install) task, activations should be chained after it.
 */
let maintenance;
/**
 * Pending activation flag. Will be cleared when the process produces some message or fails.
 */
let activationPending = false;
function activateWithJDK(specifiedJDK, context, log, notifyKill) {
    if (activationPending) {
        // do not activate more than once in parallel.
        handleLog(log, "Server activation requested repeatedly, ignoring...");
        return;
    }
    let oldClient = client;
    let setClient;
    client = new Promise((clientOK, clientErr) => {
        setClient = [clientOK, clientErr];
    });
    const a = maintenance;
    vscode_1.commands.executeCommand('setContext', 'nbJavaLSReady', false);
    activationPending = true;
    // chain the restart after termination of the former process.
    if (a != null) {
        handleLog(log, "Server activation initiated while in maintenance mode, scheduling after maintenance");
        a.then(() => stopClient(oldClient)).then(() => killNbProcess(notifyKill, log)).then(() => {
            doActivateWithJDK(specifiedJDK, context, log, notifyKill, setClient);
        });
    }
    else {
        handleLog(log, "Initiating server activation");
        stopClient(oldClient).then(() => killNbProcess(notifyKill, log)).then(() => {
            doActivateWithJDK(specifiedJDK, context, log, notifyKill, setClient);
        });
    }
}
function killNbProcess(notifyKill, log, specProcess) {
    const p = nbProcess;
    handleLog(log, "Request to kill LSP server.");
    if (p && (!specProcess || specProcess == p)) {
        if (notifyKill) {
            vscode.window.setStatusBarMessage("Restarting Apache NetBeans Language Server.", 2000);
        }
        return new Promise((resolve, reject) => {
            nbProcess = null;
            p.on('close', function (code) {
                handleLog(log, "LSP server closed: " + p.pid);
                resolve();
            });
            handleLog(log, "Killing LSP server " + p.pid);
            if (!p.kill()) {
                reject("Cannot kill");
            }
        });
    }
    else {
        let msg = "Cannot kill: ";
        if (specProcess) {
            msg += "Requested kill on " + specProcess.pid + ", ";
        }
        handleLog(log, msg + "current process is " + (p ? p.pid : "None"));
        return new Promise((res, rej) => { res(); });
    }
}
function doActivateWithJDK(specifiedJDK, context, log, notifyKill, setClient) {
    maintenance = null;
    let restartWithJDKLater = function restartLater(time, n) {
        handleLog(log, `Restart of Apache Language Server requested in ${(time / 1000)} s.`);
        setTimeout(() => {
            activateWithJDK(specifiedJDK, context, log, n);
        }, time);
    };
    const beVerbose = vscode_1.workspace.getConfiguration('netbeans').get('verbose', false);
    let info = {
        clusters: findClusters(context.extensionPath),
        extensionPath: context.extensionPath,
        storagePath: context.globalStoragePath,
        jdkHome: specifiedJDK,
        verbose: beVerbose
    };
    let launchMsg = `Launching Apache NetBeans Language Server with ${specifiedJDK ? specifiedJDK : 'default system JDK'}`;
    handleLog(log, launchMsg);
    vscode.window.setStatusBarMessage(launchMsg, 2000);
    let ideRunning = new Promise((resolve, reject) => {
        let stdOut = '';
        function logAndWaitForEnabled(text, isOut) {
            if (p == nbProcess) {
                activationPending = false;
            }
            handleLogNoNL(log, text);
            if (stdOut == null) {
                return;
            }
            if (isOut) {
                stdOut += text;
            }
            if (stdOut.match(/org.netbeans.modules.java.lsp.server/)) {
                resolve(text);
                stdOut = null;
            }
        }
        let p = launcher.launch(info, "--modules", "--list");
        handleLog(log, "LSP server launching: " + p.pid);
        p.stdout.on('data', function (d) {
            logAndWaitForEnabled(d.toString(), true);
        });
        p.stderr.on('data', function (d) {
            logAndWaitForEnabled(d.toString(), false);
        });
        nbProcess = p;
        p.on('close', function (code) {
            if (p == nbProcess) {
                nbProcess = null;
            }
            if (p == nbProcess && code != 0 && code) {
                vscode.window.showWarningMessage("Apache NetBeans Language Server exited with " + code);
            }
            if (stdOut != null) {
                let match = stdOut.match(/org.netbeans.modules.java.lsp.server[^\n]*/);
                if ((match === null || match === void 0 ? void 0 : match.length) == 1) {
                    handleLog(log, match[0]);
                }
                else {
                    handleLog(log, "Cannot find org.netbeans.modules.java.lsp.server in the log!");
                }
                log.show(false);
                killNbProcess(false, log, p);
                reject("Apache NetBeans Language Server not enabled!");
            }
            else {
                handleLog(log, "LSP server " + p.pid + " terminated with " + code);
                handleLog(log, "Exit code " + code);
            }
        });
    });
    ideRunning.then(() => {
        const connection = () => new Promise((resolve, reject) => {
            const server = net.createServer(socket => {
                server.close();
                resolve({
                    reader: socket,
                    writer: socket
                });
            });
            server.on('error', (err) => {
                reject(err);
            });
            server.listen(() => {
                const address = server.address();
                const srv = launcher.launch(info, `--start-java-language-server=connect:${address.port}`, `--start-java-debug-adapter-server=listen:0`);
                if (!srv) {
                    reject();
                }
                else {
                    if (!srv.stdout) {
                        reject(`No stdout to parse!`);
                        srv.disconnect();
                        return;
                    }
                    debugPort = -1;
                    srv.stdout.on("data", (chunk) => {
                        if (debugPort < 0) {
                            const info = chunk.toString().match(/Debug Server Adapter listening at port (\d*)/);
                            if (info) {
                                debugPort = info[1];
                            }
                        }
                    });
                    srv.once("error", (err) => {
                        reject(err);
                    });
                }
            });
        });
        // Options to control the language client
        let clientOptions = {
            // Register the server for java documents
            documentSelector: [{ language: 'java' }, { language: 'yaml', pattern: '**/application.yml' }],
            synchronize: {
                configurationSection: 'java',
                fileEvents: [
                    vscode_1.workspace.createFileSystemWatcher('**/*.java')
                ]
            },
            outputChannel: log,
            revealOutputChannelOn: vscode_languageclient_1.RevealOutputChannelOn.Never,
            progressOnInitialization: true,
            initializationOptions: {
                'nbcodeCapabilities': {
                    'statusBarMessageSupport': true,
                    'testResultsSupport': true
                }
            },
            errorHandler: {
                error: function (_error, _message, count) {
                    return vscode_languageclient_1.ErrorAction.Continue;
                },
                closed: function () {
                    handleLog(log, "Connection to Apache NetBeans Language Server closed.");
                    if (!activationPending) {
                        restartWithJDKLater(10000, false);
                    }
                    return vscode_languageclient_1.CloseAction.DoNotRestart;
                }
            }
        };
        let c = new vscode_languageclient_1.LanguageClient('java', 'NetBeans Java', connection, clientOptions);
        handleLog(log, 'Language Client: Starting');
        c.start();
        c.onReady().then(() => {
            c.onNotification(protocol_1.StatusMessageRequest.type, showStatusBarMessage);
            c.onNotification(vscode_languageclient_1.LogMessageNotification.type, (param) => handleLog(log, param.message));
            c.onRequest(protocol_1.QuickPickRequest.type, (param) => __awaiter(this, void 0, void 0, function* () {
                const selected = yield vscode_1.window.showQuickPick(param.items, { placeHolder: param.placeHolder, canPickMany: param.canPickMany });
                return selected ? Array.isArray(selected) ? selected : [selected] : undefined;
            }));
            c.onRequest(protocol_1.InputBoxRequest.type, (param) => __awaiter(this, void 0, void 0, function* () {
                return yield vscode_1.window.showInputBox({ prompt: param.prompt, value: param.value });
            }));
            c.onNotification(protocol_1.TestProgressNotification.type, param => {
                if (testAdapterRegistrar) {
                    const ws = vscode_1.workspace.getWorkspaceFolder(vscode.Uri.parse(param.uri));
                    if (ws) {
                        const adapter = testAdapterRegistrar.getAdapter(ws);
                        if (adapter) {
                            adapter.testProgress(param.suite);
                        }
                    }
                }
            });
            handleLog(log, 'Language Client: Ready');
            setClient[0](c);
            vscode_1.commands.executeCommand('setContext', 'nbJavaLSReady', true);
        }).catch(setClient[1]);
    }).catch((reason) => {
        activationPending = false;
        handleLog(log, reason);
        vscode_1.window.showErrorMessage('Error initializing ' + reason);
    });
    function showStatusBarMessage(params) {
        let decorated = params.message;
        let defTimeout;
        switch (params.type) {
            case vscode_languageclient_1.MessageType.Error:
                decorated = '$(error) ' + params.message;
                defTimeout = 0;
                checkInstallNbJavac(params.message);
                break;
            case vscode_languageclient_1.MessageType.Warning:
                decorated = '$(warning) ' + params.message;
                defTimeout = 0;
                break;
            default:
                defTimeout = 10000;
                break;
        }
        // params.timeout may be defined but 0 -> should be used
        const timeout = params.timeout != undefined ? params.timeout : defTimeout;
        if (timeout > 0) {
            vscode_1.window.setStatusBarMessage(decorated, timeout);
        }
        else {
            vscode_1.window.setStatusBarMessage(decorated);
        }
    }
    function checkInstallNbJavac(msg) {
        const NO_JAVA_SUPPORT = "Cannot initialize Java support";
        if (msg.startsWith(NO_JAVA_SUPPORT)) {
            const yes = "Install GPLv2+CPEx code";
            vscode_1.window.showErrorMessage("Additional Java Support is needed", yes).then(reply => {
                if (yes === reply) {
                    vscode.window.setStatusBarMessage("Preparing Apache NetBeans Language Server for additional installation", 2000);
                    restartWithJDKLater = function () {
                        handleLog(log, "Ignoring request for restart of Apache NetBeans Language Server");
                    };
                    maintenance = new Promise((resolve, reject) => {
                        const kill = killNbProcess(false, log);
                        kill.then(() => {
                            let installProcess = launcher.launch(info, "-J-Dnetbeans.close=true", "--modules", "--install", ".*nbjavac.*");
                            handleLog(log, "Launching installation process: " + installProcess.pid);
                            let logData = function (d) {
                                handleLogNoNL(log, d.toString());
                            };
                            installProcess.stdout.on('data', logData);
                            installProcess.stderr.on('data', logData);
                            installProcess.addListener("error", reject);
                            // MUST wait on 'close', since stdout is inherited by children. The installProcess dies but
                            // the inherited stream will be closed by the last child dying.
                            installProcess.on('close', function (code) {
                                handleLog(log, "Installation completed: " + installProcess.pid);
                                handleLog(log, "Additional Java Support installed with exit code " + code);
                                // will be actually run after maintenance is resolve()d.
                                activateWithJDK(specifiedJDK, context, log, notifyKill);
                                resolve();
                            });
                            return installProcess;
                        });
                    });
                }
            });
        }
    }
}
function stopClient(clinetPromise) {
    return clinetPromise ? clinetPromise.then(c => c.stop()) : Promise.resolve();
}
function deactivate() {
    if (nbProcess != null) {
        nbProcess.kill();
    }
    return stopClient(client);
}
exports.deactivate = deactivate;
class NetBeansDebugAdapterDescriptionFactory {
    createDebugAdapterDescriptor(_session, _executable) {
        return new Promise((resolve, reject) => {
            let cnt = 10;
            const fnc = () => {
                if (debugPort < 0) {
                    if (cnt-- > 0) {
                        setTimeout(fnc, 1000);
                    }
                    else {
                        reject(new Error('Apache NetBeans Debug Server Adapter not yet initialized. Please wait for a while and try again.'));
                    }
                }
                else {
                    resolve(new vscode.DebugAdapterServer(debugPort));
                }
            };
            fnc();
        });
    }
}
class NetBeansConfigurationProvider {
    resolveDebugConfiguration(_folder, config, _token) {
        if (!config.type) {
            config.type = 'java8+';
        }
        if (!config.request) {
            config.request = 'launch';
        }
        if (!config.mainClass) {
            config.mainClass = '${file}';
        }
        if (!config.classPaths) {
            config.classPaths = ['any'];
        }
        if (!config.console) {
            config.console = 'internalConsole';
        }
        return config;
    }
}
class NetBeansConfigurationNativeProvider {
    resolveDebugConfiguration(_folder, config, _token) {
        if (!config.type) {
            config.type = 'nativeimage';
        }
        if (!config.request) {
            config.request = 'launch';
        }
        if (!config.nativeImagePath) {
            config.nativeImagePath = '${workspaceFolder}/build/native-image/application';
        }
        if (!config.miDebugger) {
            config.miDebugger = 'gdb';
        }
        if (!config.console) {
            config.console = 'internalConsole';
        }
        return config;
    }
}
//# sourceMappingURL=extension.js.map