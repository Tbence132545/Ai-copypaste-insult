import * as vscode from 'vscode';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
//I declared it here, idk man
let pythonProc: ChildProcessWithoutNullStreams | null = null;

export function activate(context: vscode.ExtensionContext) {
    const insults = [
        "Take a long look into a mirror.",
        "Lowkey pathetic!",
        "I hope gpt writes your wedding speech as well",
        "Cheater, shame on you!",
        "Just deploy it to prod without testing, I dare you",
        "I see you mastered the art of being worthless",
        "Do you even understand what you just wrote?",
        "Your code screams 'I give up'.",
        "Womp womp, touch some documentation.",
        "Do you ask chatgpt what to eat for dinner as well?",
        "Could you seriously not think of that on your own?"
    ];

    const venvPath = path.join(context.extensionPath, 'venv');
    const pythonPath = path.join(venvPath, 'bin', 'python3');
    const requirementsPath = path.join(context.extensionPath, 'src', 'detector', 'requirements.txt');
    const detectorPath = path.join(context.extensionPath, 'src', 'detector', 'test.py');

    const aiHighlightDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255,0,0,0.3)',
        border: '1px solid red',
    });

    async function setupEnvironment() {
        if (!fs.existsSync(pythonPath)) {
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Setting up AI Detector...', cancellable: false },
                async (progress) => {
                    progress.report({ message: 'Creating virtual environment...', increment: 10 });
                    await new Promise<void>((resolve, reject) => {
                        const cmd = `python3 -m venv "${venvPath}"`;
                        require('child_process').exec(cmd, (err: any) => err ? reject(err) : resolve());
                    });

                    progress.report({ message: 'Upgrading pip...', increment: 30 });
                    await new Promise<void>((resolve) => {
                        require('child_process').exec(`"${pythonPath}" -m pip install --upgrade pip`, () => resolve());
                    });

                    progress.report({ message: 'Installing dependencies...', increment: 60 });
                    await new Promise<void>((resolve, reject) => {
                        require('child_process').exec(`"${pythonPath}" -m pip install -r "${requirementsPath}"`, (err: any) => err ? reject(err) : resolve());
                    });

                    progress.report({ message: 'Downloading AI model...', increment: 90 });
                    // Call once to download model weights
                    await new Promise<void>((resolve) => {
                        const setupProc = spawn(pythonPath, [detectorPath, 'setup']);
                        setupProc.on('exit', () => resolve());
                    });

                    progress.report({ message: 'AI Detector is ready!', increment: 100 });
                    vscode.window.showInformationMessage('AI Detector setup complete!');
                }
            );
        }
   
        pythonProc = spawn(pythonPath, [detectorPath]);
        pythonProc.stderr.on('data', data => console.error('Python stderr:', data.toString()));
    }

    setupEnvironment();

    const disposable = vscode.workspace.onDidChangeTextDocument((event) => {
        if (!pythonProc) return;
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const changes = event.contentChanges;
        if (!changes.length) return;

        const pastedText = changes.map(c => c.text).join('');
        if (!pastedText.trim() || pastedText.length < 10) return;

        // Send text to Python worker
        pythonProc.stdin.write(pastedText.replace(/\n/g, ' ') + '\n');

        let buffer = '';
        const onData = (data: Buffer) => {
            buffer += data.toString();
            if (buffer.endsWith('\n')) {
                try {
                    const [humanProb, aiProb] = JSON.parse(buffer.trim());
                    buffer = '';

                    const startPos = changes[0].range.start;
                    const lastLine = startPos.line + pastedText.split('\n').length - 1;
                    const lastLineText = pastedText.split('\n').slice(-1)[0];
                    const endPos = new vscode.Position(lastLine, lastLineText.length);
                    const range = new vscode.Range(startPos, endPos);

                    if (aiProb > 0.5) {
                        const insult = insults[Math.floor(Math.random() * insults.length)];
                        vscode.window.showWarningMessage(insult);
                        editor.setDecorations(aiHighlightDecoration, [range]);

                        setTimeout(() => editor.setDecorations(aiHighlightDecoration, []), 5000);
                    } else {
                        vscode.window.showInformationMessage(
                            `Mostly human (${(humanProb * 100).toFixed(1)}% probability)`
                        );
                    }
                } catch (e) {
                    console.error('Parse error:', e, buffer);
                } finally {
                    pythonProc?.stdout.removeListener('data', onData);
                }
            }
        };
        pythonProc.stdout.on('data', onData);
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    // Kill python worker on deactivate
    pythonProc?.kill();
}
