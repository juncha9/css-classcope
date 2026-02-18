import * as vscode from 'vscode';
import { findCssModuleForTsx, findClassRanges } from './css-finder';
import { getCssModuleImportIdentifier, getClassNameAtCursorWithIdentifier } from './tsx-parser';

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

export function activate(context: vscode.ExtensionContext) {
    highlightDecoration = createHighlightDecoration();

    // 설정 변경 시 decoration 재생성
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('styleCompass.highlightColor')) {
                highlightDecoration?.dispose();
                highlightDecoration = createHighlightDecoration();
            }
        })
    );

    // 커서 위치 변경 감지
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(async event => {
            const editor = event.textEditor;
            if (editor.document.languageId !== 'typescriptreact') {
                return;
            }
            await updateHighlight(editor);
        })
    );

    // 활성 에디터 변경 감지
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async editor => {
            if (!editor || editor.document.languageId !== 'typescriptreact') {
                clearAllHighlights();
                return;
            }
            await updateHighlight(editor);
        })
    );

    // 현재 에디터가 TSX이면 즉시 실행
    const active = vscode.window.activeTextEditor;
    if (active?.document.languageId === 'typescriptreact') {
        updateHighlight(active);
    }
}

async function updateHighlight(tsxEditor: vscode.TextEditor): Promise<void> {
    clearAllHighlights();

    const position = tsxEditor.selection.active;
    const document = tsxEditor.document;

    // import identifier 찾기 (styles, cls 등)
    const identifier = getCssModuleImportIdentifier(document);
    if (!identifier) {
        return;
    }

    // 커서 위치에서 클래스명 추출
    const className = getClassNameAtCursorWithIdentifier(document, position, identifier);
    if (!className) {
        return;
    }

    // 대응하는 CSS Module 파일 찾기
    const cssUri = await findCssModuleForTsx(document.uri);
    if (!cssUri) {
        return;
    }

    // CSS 파일의 탭 에디터를 가져오거나 열기
    const cssDocument = await vscode.workspace.openTextDocument(cssUri);

    // 하이라이트할 범위 찾기
    const ranges = findClassRanges(cssDocument, className);
    if (ranges.length === 0) {
        return;
    }

    // 현재 열려있는 CSS 에디터에 하이라이트 적용
    // CSS 파일이 열려있는 탭의 에디터를 찾기
    const cssEditor = vscode.window.visibleTextEditors.find(
        e => e.document.uri.toString() === cssUri.toString()
    );

    if (cssEditor && highlightDecoration) {
        cssEditor.setDecorations(highlightDecoration, ranges);

        // 첫 번째 매칭 위치로 reveal (스크롤)
        cssEditor.revealRange(ranges[0], vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    } else {
        // CSS 파일이 보이지 않으면 옆에 열기
        await vscode.window.showTextDocument(cssUri, {
            viewColumn: vscode.ViewColumn.Beside,
            preserveFocus: true,
            preview: false,
        });

        // 열린 후 하이라이트 적용
        const newCssEditor = vscode.window.visibleTextEditors.find(
            e => e.document.uri.toString() === cssUri.toString()
        );
        if (newCssEditor && highlightDecoration) {
            newCssEditor.setDecorations(highlightDecoration, ranges);
            newCssEditor.revealRange(ranges[0], vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        }
    }
}

function clearAllHighlights(): void {
    if (!highlightDecoration) {
        return;
    }
    for (const editor of vscode.window.visibleTextEditors) {
        editor.setDecorations(highlightDecoration, []);
    }
}

export function deactivate() {
    highlightDecoration?.dispose();
}
