"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const http = __importStar(require("http"));
let server = null;
let outputChannel;
let currentConfig = {
    count: 3,
    roles: ['officer', 'leader', 'member_1']
};
function activate(context) {
    outputChannel = vscode.window.createOutputChannel('Terminal Relay');
    outputChannel.appendLine('Terminal Relay extension activated');
    const startServerCmd = vscode.commands.registerCommand('terminal-relay.startServer', () => startServer());
    const stopServerCmd = vscode.commands.registerCommand('terminal-relay.stopServer', () => stopServer());
    const testFocusCmd = vscode.commands.registerCommand('terminal-relay.testFocus', () => testTerminalFocus());
    context.subscriptions.push(startServerCmd, stopServerCmd, testFocusCmd, outputChannel);
    // Auto-start server
    startServer();
}
function startServer() {
    if (server) {
        outputChannel.appendLine('Server already running');
        vscode.window.showInformationMessage('Terminal Relay: Server already running');
        return;
    }
    server = http.createServer((req, res) => {
        const url = new URL(req.url || '/', `http://localhost:${getPort()}`);
        outputChannel.appendLine(`Request: ${url.pathname}`);
        if (url.pathname === '/focus') {
            const index = parseInt(url.searchParams.get('index') || '0', 10);
            focusTerminal(index);
            res.end(`OK: Focus terminal ${index}`);
        }
        else if (url.pathname === '/notify') {
            const terminal = parseInt(url.searchParams.get('terminal') || '0', 10);
            const message = url.searchParams.get('message') || 'Notification received';
            focusTerminal(terminal);
            setTimeout(() => {
                sendToTerminal(terminal, `echo "${message}"\n`);
            }, 500);
            res.end(`OK: Notified terminal ${terminal}`);
        }
        else if (url.pathname === '/send') {
            const terminal = parseInt(url.searchParams.get('terminal') || '0', 10);
            const text = url.searchParams.get('text') || '';
            sendToTerminal(terminal, text);
            res.end(`OK: Sent to terminal ${terminal}`);
        }
        else if (url.pathname === '/chat') {
            const terminal = parseInt(url.searchParams.get('terminal') || '0', 10);
            const text = url.searchParams.get('text') || '';
            sendChatMessage(terminal, text);
            res.end(`OK: Chat sent to terminal ${terminal}`);
        }
        else if (url.pathname === '/chat2') {
            const terminal = parseInt(url.searchParams.get('terminal') || '0', 10);
            const text = url.searchParams.get('text') || '';
            sendChatMethod2(terminal, text);
            res.end(`OK: Chat2 sent to terminal ${terminal}`);
        }
        else if (url.pathname === '/chat3') {
            const terminal = parseInt(url.searchParams.get('terminal') || '0', 10);
            const text = url.searchParams.get('text') || '';
            sendChatMethod3(terminal, text);
            res.end(`OK: Chat3 sent to terminal ${terminal}`);
        }
        else if (url.pathname === '/chat4') {
            const terminal = parseInt(url.searchParams.get('terminal') || '0', 10);
            const text = url.searchParams.get('text') || '';
            sendChatMethod4(terminal, text);
            res.end(`OK: Chat4 sent to terminal ${terminal}`);
        }
        else if (url.pathname === '/chat5') {
            const terminal = parseInt(url.searchParams.get('terminal') || '0', 10);
            const text = url.searchParams.get('text') || '';
            sendChatMethod5(terminal, text);
            res.end(`OK: Chat5 sent to terminal ${terminal}`);
        }
        else if (url.pathname === '/test') {
            testTerminalFocus();
            res.end('OK: Test executed');
        }
        else if (url.pathname === '/split') {
            const count = parseInt(url.searchParams.get('count') || '3', 10);
            splitTerminals(count);
            res.end(`OK: Splitting to ${count} terminals`);
        }
        else if (url.pathname === '/setup') {
            const count = parseInt(url.searchParams.get('count') || '3', 10);
            const rolesParam = url.searchParams.get('roles');
            const roles = rolesParam ? rolesParam.split(',') : getDefaultRoles(count);
            setupTerminals(count, roles);
            res.end(`OK: Setting up ${count} terminals with roles: ${roles.join(', ')}`);
        }
        else if (url.pathname === '/list') {
            listTerminals();
            res.end(`OK: Listed ${vscode.window.terminals.length} terminals`);
        }
        else if (url.pathname === '/config') {
            const count = parseInt(url.searchParams.get('count') || '3', 10);
            const rolesParam = url.searchParams.get('roles');
            const roles = rolesParam ? rolesParam.split(',') : getDefaultRoles(count);
            currentConfig = { count, roles };
            res.end(`OK: Config set to ${count} terminals with roles: ${roles.join(', ')}`);
        }
        else {
            res.end('Terminal Relay is running. Use /focus, /notify, /send, /split, /setup, /list, or /config');
        }
    });
    const port = getPort();
    server.listen(port, () => {
        outputChannel.appendLine(`Server started on port ${port}`);
        vscode.window.showInformationMessage(`Terminal Relay: Server started on port ${port}`);
    });
}
function stopServer() {
    if (server) {
        server.close();
        server = null;
        outputChannel.appendLine('Server stopped');
        vscode.window.showInformationMessage('Terminal Relay: Server stopped');
    }
}
function getPort() {
    const config = vscode.workspace.getConfiguration('terminalRelay');
    return config.get('port', 3773);
}
function focusTerminal(index) {
    outputChannel.appendLine(`Focusing terminal ${index}`);
    // Method 1: Focus by index
    vscode.commands.executeCommand('workbench.action.terminal.focusAtIndex', index);
    // Also try showing terminal panel
    vscode.commands.executeCommand('workbench.action.terminal.focus');
}
function sendToTerminal(index, text) {
    const terminals = vscode.window.terminals;
    if (index >= 0 && index < terminals.length) {
        terminals[index].sendText(text);
        outputChannel.appendLine(`Sent to terminal ${index}: ${text.substring(0, 50)}...`);
    }
    else {
        outputChannel.appendLine(`Terminal ${index} not found. Available: ${terminals.length}`);
    }
}
function sendChatMessage(index, text) {
    const terminals = vscode.window.terminals;
    if (index >= 0 && index < terminals.length) {
        // tmuxの2回送信アプローチ
        // 1. テキストだけ送る（改行なし）
        terminals[index].sendText(text, false);
        outputChannel.appendLine(`Chat text sent to terminal ${index}: ${text}`);
        // 2. 1秒待ってからEnterを送る（tmuxの2回送信アプローチ）
        setTimeout(() => {
            // 方法1: sendTextで空文字+改行
            terminals[index].sendText('', true);
            outputChannel.appendLine(`Enter (sendText) sent to terminal ${index}`);
        }, 1000);
    }
    else {
        outputChannel.appendLine(`Terminal ${index} not found. Available: ${terminals.length}`);
    }
}
function sendChatMethod2(index, text) {
    const terminals = vscode.window.terminals;
    if (index >= 0 && index < terminals.length) {
        terminals[index].sendText(text, false);
        setTimeout(() => {
            vscode.commands.executeCommand('workbench.action.terminal.sendSequence', {
                text: '\r'
            });
            outputChannel.appendLine(`Enter (sendSequence \\r) sent to terminal ${index}`);
        }, 1000);
    }
}
function sendChatMethod3(index, text) {
    const terminals = vscode.window.terminals;
    if (index >= 0 && index < terminals.length) {
        terminals[index].sendText(text, false);
        setTimeout(() => {
            vscode.commands.executeCommand('workbench.action.terminal.sendSequence', {
                text: '\n'
            });
            outputChannel.appendLine(`Enter (sendSequence \\n) sent to terminal ${index}`);
        }, 1000);
    }
}
function sendChatMethod4(index, text) {
    const terminals = vscode.window.terminals;
    if (index >= 0 && index < terminals.length) {
        terminals[index].sendText(text, false);
        setTimeout(() => {
            terminals[index].sendText('\n', false);
            outputChannel.appendLine(`Enter (sendText \\n) sent to terminal ${index}`);
        }, 1000);
    }
}
function sendChatMethod5(index, text) {
    const terminals = vscode.window.terminals;
    if (index >= 0 && index < terminals.length) {
        terminals[index].sendText(text, false);
        setTimeout(() => {
            vscode.commands.executeCommand('workbench.action.terminal.sendSequence', {
                text: String.fromCharCode(13) // CR
            });
            outputChannel.appendLine(`Enter (charCode 13) sent to terminal ${index}`);
        }, 1000);
    }
}
function testTerminalFocus() {
    outputChannel.appendLine('=== Terminal Focus Test ===');
    // Create a terminal if none exists
    if (vscode.window.terminals.length === 0) {
        vscode.window.createTerminal('Test Terminal');
        outputChannel.appendLine('Created test terminal');
    }
    const terminals = vscode.window.terminals;
    outputChannel.appendLine(`Terminals: ${terminals.length}`);
    terminals.forEach((t, i) => {
        outputChannel.appendLine(`  [${i}] ${t.name}`);
    });
    // Focus first terminal
    vscode.commands.executeCommand('workbench.action.terminal.focusAtIndex', 0);
    // Send test message after delay
    setTimeout(() => {
        if (terminals.length > 0) {
            terminals[0].sendText('echo "Terminal focus test successful!"\n');
        }
    }, 1000);
    vscode.window.showInformationMessage('Terminal Focus Test: Check terminal panel');
}
function deactivate() {
    stopServer();
}
function getDefaultRoles(count) {
    switch (count) {
        case 2:
            return ['member_1', 'member_2'];
        case 3:
            return ['leader', 'member_1', 'member_2'];
        case 4:
            return ['officer', 'leader', 'member_1', 'member_2'];
        case 5:
            return ['officer', 'leader', 'member_1', 'member_2', 'member_3'];
        case 6:
            return ['officer', 'leader', 'member_1', 'member_2', 'member_3', 'member_4'];
        default:
            const roles = ['officer', 'leader'];
            for (let i = 1; i <= count - 2; i++) {
                roles.push(`member_${i}`);
            }
            return roles;
    }
}
async function splitTerminals(count) {
    outputChannel.appendLine(`Splitting to ${count} terminals...`);
    // Get current terminal count
    const currentCount = vscode.window.terminals.length;
    outputChannel.appendLine(`Current terminals: ${currentCount}`);
    if (currentCount === 0) {
        // Create first terminal
        const terminal = vscode.window.createTerminal('Pane 0');
        terminal.show();
        outputChannel.appendLine('Created first terminal');
    }
    // Split to reach desired count
    const splitsNeeded = count - vscode.window.terminals.length;
    for (let i = 0; i < splitsNeeded; i++) {
        await vscode.commands.executeCommand('workbench.action.terminal.split');
        outputChannel.appendLine(`Split ${i + 1}/${splitsNeeded}`);
        // Small delay between splits
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    // List final state
    setTimeout(() => {
        const terminals = vscode.window.terminals;
        outputChannel.appendLine(`Final terminal count: ${terminals.length}`);
        terminals.forEach((t, i) => {
            outputChannel.appendLine(`  [${i}] ${t.name}`);
        });
    }, 500);
}
async function setupTerminals(count, roles) {
    outputChannel.appendLine(`Setting up ${count} terminals with roles: ${roles.join(', ')}`);
    // First, close all existing terminals (optional - commented out for safety)
    // vscode.window.terminals.forEach(t => t.dispose());
    // Create terminals with role names
    const terminals = [];
    for (let i = 0; i < count; i++) {
        const roleName = roles[i] || `pane_${i}`;
        const terminalName = `${roleName} (Pane ${i})`;
        if (i === 0) {
            // Create first terminal
            const terminal = vscode.window.createTerminal(terminalName);
            terminal.show();
            terminals.push(terminal);
        }
        else {
            // Split from previous terminal
            // Note: split creates a new terminal but we can't easily name it
            await vscode.commands.executeCommand('workbench.action.terminal.split');
            await new Promise(resolve => setTimeout(resolve, 300));
            // Get the newly created terminal (should be the last one)
            const allTerminals = vscode.window.terminals;
            const newTerminal = allTerminals[allTerminals.length - 1];
            terminals.push(newTerminal);
        }
        outputChannel.appendLine(`Created terminal ${i}: ${terminalName}`);
    }
    // Log final state
    setTimeout(() => {
        outputChannel.appendLine('=== Terminal Setup Complete ===');
        vscode.window.terminals.forEach((t, i) => {
            outputChannel.appendLine(`  [${i}] ${t.name} -> role: ${roles[i] || 'unknown'}`);
        });
        vscode.window.showInformationMessage(`Terminal Relay: Set up ${count} terminals`);
    }, 500);
}
function listTerminals() {
    const terminals = vscode.window.terminals;
    outputChannel.appendLine(`=== Terminal List (${terminals.length}) ===`);
    terminals.forEach((t, i) => {
        outputChannel.appendLine(`  [${i}] ${t.name}`);
    });
    vscode.window.showInformationMessage(`Terminal Relay: ${terminals.length} terminals available`);
}
//# sourceMappingURL=extension.js.map