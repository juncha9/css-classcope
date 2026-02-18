import * as vscode from 'vscode';
import { findCssModuleForTsx, findClassRanges } from './css-finder';
import { getCssModuleImportIdentifier, getChildGroupsAtCursor } from './tsx-parser';

// 현재 활성화된 decoration 목록 (매 업데이트마다 교체)
let activeDecorations: vscode.TextEditorDecorationType[] = [];

/**
 * 골든 비율 기반 HSL 색상 생성기
 * 자식 index를 받아서 시각적으로 잘 구분되는 색상을 반환합니다.
 */
function generateColor(index: number): { bg: string; border: string } {
    const goldenAngle = 137.508; // 황금각 (도)
    const hue = (index * goldenAngle) % 360;
    return {
        bg: `hsla(${hue.toFixed(0)}, 80%, 60%, 0.25)`,
        border: `hsla(${hue.toFixed(0)}, 80%, 50%, 0.7)`,
    };
}

function createDecoration(index: number): vscode.TextEditorDecorationType {
    const { bg, border } = generateColor(index);
    return vscode.window.createTextEditorDecorationType({
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: '2px',
    });
}

function clearAllHighlights(): void {
    for (const dec of activeDecorations) {
        dec.dispose();
    }
    activeDecorations = [];
}

export function activate(context: vscode.ExtensionContext) {

    // 커서 위치 변경 감지
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

    // 활성 에디터 변경 감지
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async editor => {
            clearAllHighlights();
            if (!editor || editor.document.languageId !== 'typescriptreact') {
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

/**
 * TSX 문서에서 identifier.className 패턴의 범위를 찾습니다.
 * e.g. classNames=['panel', 'title'], identifier='styles'
 *   → styles.panel, styles.title 이 있는 위치 전부 반환
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

    const position = tsxEditor.selection.active;
    const document = tsxEditor.document;

    // CSS Module import identifier 찾기 (styles, cls 등)
    const identifier = getCssModuleImportIdentifier(document);
    if (!identifier) { return; }

    // 커서 위치의 직접 자식 그룹 추출 (AST 기반)
    const groups = getChildGroupsAtCursor(document, position, identifier);
    if (groups.length === 0) { return; }

    // 대응하는 CSS Module 파일 찾기
    const cssUri = await findCssModuleForTsx(document.uri);
    if (!cssUri) { return; }

    // CSS 파일이 현재 화면에 보이는지 확인
    const cssEditor = vscode.window.visibleTextEditors.find(
        e => e.document.uri.toString() === cssUri.toString()
    );
    if (!cssEditor) { return; }

    const cssDocument = await vscode.workspace.openTextDocument(cssUri);

    // 각 자식 그룹에 색상별 decoration 적용 (CSS + TSX 양쪽)
    groups.forEach((group, index) => {
        const cssRanges = group.classNames.flatMap(cls => findClassRanges(cssDocument, cls));
        const tsxRanges = findStyleReferencesInTsx(document, group.classNames, identifier);

        if (cssRanges.length === 0 && tsxRanges.length === 0) { return; }

        const decoration = createDecoration(index);
        activeDecorations.push(decoration);

        if (cssRanges.length > 0) {
            cssEditor.setDecorations(decoration, cssRanges);
        }
        if (tsxRanges.length > 0) {
            tsxEditor.setDecorations(decoration, tsxRanges);
        }
    });
}

export function deactivate() {
    clearAllHighlights();
}
