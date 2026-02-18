import * as vscode from 'vscode';
import { findCssModuleForTsx, findClassRanges } from './css-finder';
import { getCssModuleImportIdentifier, getClassNamesAtElement } from './tsx-parser';

let highlightDecoration: vscode.TextEditorDecorationType | undefined;

function createHighlightDecoration(): vscode.TextEditorDecorationType {
    const config = vscode.workspace.getConfiguration('styleCompass');
    const color = config.get<string>('highlightColor', 'rgba(255, 200, 0, 0.3)');
    return vscode.window.createTextEditorDecorationType({
        backgroundColor: color,
        border: '1px solid rgba(255, 200, 0, 0.6)',
        borderRadius: '2px',
    });
}

function clearAllHighlights(): void {
    if (!highlightDecoration) { return; }
    for (const editor of vscode.window.visibleTextEditors) {
        editor.setDecorations(highlightDecoration, []);
    }
}

export function activate(context: vscode.ExtensionContext) {
    highlightDecoration = createHighlightDecoration();

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('styleCompass.highlightColor')) {
                highlightDecoration?.dispose();
                highlightDecoration = createHighlightDecoration();
            }
        })
    );

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

/**
 * TSX 문서에서 identifier.className 패턴의 위치를 찾습니다.
 */
function findStyleReferencesInTsx(
    document: vscode.TextDocument,
    classNames: string[],
    identifier: string
): vscode.Range[] {
    const text = document.getText();
    const ranges: vscode.Range[] = [];

    for (const className of classNames) {
        const pattern = new RegExp(`${escapeRegex(identifier)}\\.${escapeRegex(className)}(?![a-zA-Z0-9_])`, 'g');
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
            const start = document.positionAt(match.index);
            const end = document.positionAt(match.index + match[0].length);
            ranges.push(new vscode.Range(start, end));
        }
    }

    return ranges;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function updateHighlight(tsxEditor: vscode.TextEditor): Promise<void> {
    clearAllHighlights();
    if (!highlightDecoration) { return; }

    const position = tsxEditor.selection.active;
    const document = tsxEditor.document;

    const identifier = getCssModuleImportIdentifier(document);
    if (!identifier) { return; }

    // 커서가 있는 JSX 엘리먼트의 className에서만 클래스명 추출
    const classNames = getClassNamesAtElement(document, position, identifier);
    if (classNames.length === 0) { return; }

    // 대응하는 CSS Module 파일 찾기
    const cssUri = await findCssModuleForTsx(document.uri);
    if (!cssUri) { return; }

    // CSS 파일이 화면에 보일 때만 하이라이트
    const cssEditor = vscode.window.visibleTextEditors.find(
        e => e.document.uri.toString() === cssUri.toString()
    );
    if (!cssEditor) { return; }

    const cssDocument = await vscode.workspace.openTextDocument(cssUri);

    // CSS 파일 하이라이트
    const cssRanges = classNames.flatMap(cls => findClassRanges(cssDocument, cls));
    if (cssRanges.length > 0) {
        cssEditor.setDecorations(highlightDecoration, cssRanges);
    }

    // TSX 파일 하이라이트 (styles.xxx 부분)
    const tsxRanges = findStyleReferencesInTsx(document, classNames, identifier);
    if (tsxRanges.length > 0) {
        tsxEditor.setDecorations(highlightDecoration, tsxRanges);
    }
}

export function deactivate() {
    highlightDecoration?.dispose();
}
