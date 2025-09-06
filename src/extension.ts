import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
    const insults = [
        "Take a long look into a mirror.",
        "AI detected, Pathetic!",
        "I hope gpt writes your wedding speech as well",
        "Cheater, shame on you!",
        "Just deploy it to prod without testing, I dare you",
        "I see you mastered the art of being worthless",
        "Do you even understand what you just wrote?",
        "Your code screams 'I give up'.",
        "Womp womp"
    ];

    const venvPath = path.join(context.extensionPath, 'venv');
    const pythonPath = path.join(venvPath, 'bin', 'python3'); 
    const requirementsPath = path.join(context.extensionPath, 'src', 'detector', 'requirements.txt');
    const detectorPath = path.join(context.extensionPath, 'src', 'detector', 'test.py');

    async function setupEnvironment() {
        if (!fs.existsSync(pythonPath)) {
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Setting up AI Detector...', cancellable: false },
                async (progress) => {
                    progress.report({ message: 'Creating virtual environment...', increment: 10 });
                    await new Promise<void>((resolve) => {
                        exec(`python3 -m venv "${venvPath}"`, (err) => {
                            if (err) {
                                vscode.window.showErrorMessage(`Failed to create venv: ${err.message}`);
                                return;
                            }
                            resolve();
                        });
                    });

                    progress.report({ message: 'Upgrading pip...', increment: 30 });
                    await new Promise<void>((resolve) => {
                        exec(`"${pythonPath}" -m pip install --upgrade pip`, () => resolve());
                    });

                    progress.report({ message: 'Installing dependencies...', increment: 60 });
                    await new Promise<void>((resolve, reject) => {
                        exec(`"${pythonPath}" -m pip install -r "${requirementsPath}"`, (err, stdout, stderr) => {
                            if (err) {
                                vscode.window.showErrorMessage(`Failed to install dependencies: ${stderr || err.message}`);
                                reject(err);
                                return;
                            }
                            resolve();
                        });
                    });

                    progress.report({ message: 'Downloading AI model...', increment: 90 });
                    // The first call to the detector will automatically download the model if needed
                    await new Promise<void>((resolve) => {
                        exec(`"${pythonPath}" "${detectorPath}" "setup test"`, () => resolve());
                    });

                    progress.report({ message: 'AI Detector is ready!', increment: 100 });
                    vscode.window.showInformationMessage('AI Detector setup complete!');
                }
            );
        }
    }

    setupEnvironment();

    const disposable = vscode.workspace.onDidChangeTextDocument((event) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const changes = event.contentChanges;
        if (!changes.length) return;

        const pastedText = changes.map(c => c.text).join('');
        if (!pastedText.trim() || pastedText.length < 10) return;

        const proc = exec(`"${pythonPath}" "${detectorPath}"`, (err, stdout, stderr) => {
            if (err) {
                console.error("Exec error:", err, stderr);
                vscode.window.showErrorMessage(`AI detector failed: ${stderr || err.message}`);
                return;
            }

            try {
                const result = JSON.parse(stdout); // [[humanProb, aiProb]]
                const humanProb = result[0][0];
                const aiProb = result[0][1];

                if (aiProb > 0.5) {
                    const insult = insults[Math.floor(Math.random() * insults.length)];
                    vscode.window.showWarningMessage(
                        `${insult}`
                    );
                } else {
                    vscode.window.showInformationMessage(
                        `Mostly human (${(humanProb * 100).toFixed(1)}% probability)`
                    );
                }
            } catch (e) {
                console.error("Parse error:", e, stdout);
                vscode.window.showErrorMessage("AI detector returned invalid output");
            }
        });

        if (proc.stdin) {
            proc.stdin.write(pastedText);
            proc.stdin.end();
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
