import * as vscode from 'vscode';
import { findCssModuleForTsx, findClassRanges } from './css-finder';
import { getCssModuleImportIdentifier, getThreeLevelClassNames } from './tsx-parser';

// 3레벨 고정 색상 (부모 🔵 / 현재 🟡 / 자식 🟢)
const LEVEL_COLORS = [
    { bg: 'rgba(100, 149, 237, 0.30)', border: 'rgba(100, 149, 237, 0.70)' }, // parent - 파란색
    { bg: 'rgba(255, 215,   0, 0.35)', border: 'rgba(255, 215,   0, 0.80)' }, // current - 노란색
    { bg: 'rgba(144, 238, 144, 0.30)', border: 'rgba(144, 238, 144, 0.70)' }, // children - 초록색
];

let levelDecorations: vscode.TextEditorDecorationType[] = [];

function initDecorations(): void {
    disposeDecorations();
    levelDecorations = LEVEL_COLORS.map(c =>
        vscode.window.createTextEditorDecorationType({
            backgroundColor: c.bg,
            border: `1px solid ${c.border}`,
            borderRadius: '2px',
        })
    );
}

function disposeDecorations(): void {
    for (const dec of levelDecorations) { dec.dispose(); }
    levelDecorations = [];
}

function clearAllHighlights(): void {
    for (const dec of levelDecorations) {
        for (const editor of vscode.window.visibleTextEditors) {
            editor.setDecorations(dec, []);
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    initDecorations();

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(async event => {
            const editor = event.textEditor;
            if (editor.document.languageId !== 'typescriptreact') {
                clearAllHighlights();
                return;
            }
            await updateHighlight(editor);
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async editor => {
            clearAllHighlights();
            if (!editor || editor.document.languageId !== 'typescriptreact') { return; }
            await updateHighlight(editor);
        })
    );

    const active = vscode.window.activeTextEditor;
    if (active?.document.languageId === 'typescriptreact') {
        updateHighlight(active);
    }
}

function findStyleRefsInTsx(
    document: vscode.TextDocument,
    classNames: string[],
    identifier: string
): vscode.Range[] {
    if (classNames.length === 0) { return []; }
    const text = document.getText();
    const ranges: vscode.Range[] = [];
    for (const cls of classNames) {
        const pattern = new RegExp(`${escapeRegex(identifier)}\\.${escapeRegex(cls)}(?![a-zA-Z0-9_])`, 'g');
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
            ranges.push(new vscode.Range(
                document.positionAt(match.index),
                document.positionAt(match.index + match[0].length)
            ));
        }
    }
    return ranges;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function updateHighlight(tsxEditor: vscode.TextEditor): Promise<void> {
    clearAllHighlights();

    const document = tsxEditor.document;
    const position = tsxEditor.selection.active;

    const identifier = getCssModuleImportIdentifier(document);
    if (!identifier) { return; }

    const { parent, current, children } = getThreeLevelClassNames(document, position, identifier);
    if (parent.length === 0 && current.length === 0 && children.length === 0) { return; }

    const cssUri = await findCssModuleForTsx(document.uri);
    if (!cssUri) { return; }

    const cssEditor = vscode.window.visibleTextEditors.find(
        e => e.document.uri.toString() === cssUri.toString()
    );
    if (!cssEditor) { return; }

    const cssDocument = await vscode.workspace.openTextDocument(cssUri);

    // [parent, current, children] 순서로 decoration 적용
    const groups = [parent, current, children];

    groups.forEach((classNames, i) => {
        if (classNames.length === 0) { return; }
        const dec = levelDecorations[i];

        // CSS 파일 하이라이트
        const cssRanges = classNames.flatMap(cls => findClassRanges(cssDocument, cls));
        if (cssRanges.length > 0) { cssEditor.setDecorations(dec, cssRanges); }

        // TSX 파일 하이라이트
        const tsxRanges = findStyleRefsInTsx(document, classNames, identifier);
        if (tsxRanges.length > 0) { tsxEditor.setDecorations(dec, tsxRanges); }
    });
}

export function deactivate() {
    disposeDecorations();
}
