import * as vscode from 'vscode';
import {
    SELECTION_DEBOUNCE_MS,
    DEFAULT_HIGHLIGHT_COLOR,
    OUTLINE_ALPHA,
    BACKGROUND_ALPHA,
    SUPPORTED_LANGUAGES,
    JSX_LANGUAGES,
} from './_defs';
import { SourceLanguage } from './_types';
import {
    withAlpha,
    findCssModuleForTsx,
    findTsxForCssModule,
    findClassRanges,
    getClassNameAtPosition,
    getCssModuleImportIdentifier,
    getCurrentClassNames,
    findStyleRefsInTsx,
    extractRuleBlocks,
} from './_libs';

let highlightDecoration: vscode.TextEditorDecorationType | undefined;
let selectionDebounceTimer: NodeJS.Timeout | undefined;

function initDecoration(): void {
    disposeDecoration();
    const color = vscode.workspace.getConfiguration('cssClasscope')
        .get<string>('highlightColor', DEFAULT_HIGHLIGHT_COLOR);
    const strongColor = withAlpha(color, OUTLINE_ALPHA);
    const opaqueBackground = withAlpha(color, BACKGROUND_ALPHA);
    // outline은 레이아웃에 영향을 주지 않으면서 다른 decoration 위에 덧그려져
    // 선택 영역/word-match 같은 내장 하이라이트에 잘 묻히지 않는다.
    highlightDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: opaqueBackground,
        outline: `1px solid ${strongColor}`,
        borderRadius: '2px',
        overviewRulerColor: strongColor,
        overviewRulerLane: vscode.OverviewRulerLane.Right,
    });
}

function disposeDecoration(): void {
    highlightDecoration?.dispose();
    highlightDecoration = undefined;
}

function clearAllHighlights(): void {
    if (highlightDecoration == null) {
        return;
    }
    for (const editor of vscode.window.visibleTextEditors) {
        editor.setDecorations(highlightDecoration, []);
    }
}

export function activate(context: vscode.ExtensionContext) {
    initDecoration();

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(event => {
            if (selectionDebounceTimer != null) {
                clearTimeout(selectionDebounceTimer);
            }
            selectionDebounceTimer = setTimeout(() => {
                selectionDebounceTimer = undefined;
                updateHighlight(event.textEditor);
            }, SELECTION_DEBOUNCE_MS);
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async editor => {
            clearAllHighlights();
            if (editor == null) {
                return;
            }
            await updateHighlight(editor);
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('cssClasscope.highlightColor') === false) {
                return;
            }
            initDecoration();
            const active = vscode.window.activeTextEditor;
            if (active != null) {
                updateHighlight(active);
            }
        })
    );

    const jsxSelector: vscode.DocumentSelector = [...JSX_LANGUAGES];

    context.subscriptions.push(
        vscode.languages.registerHoverProvider(jsxSelector, {
            provideHover: provideStyleHover,
        })
    );

    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(jsxSelector, {
            provideDefinition: provideStyleDefinition,
        })
    );

    const active = vscode.window.activeTextEditor;
    if (active != null) {
        updateHighlight(active);
    }
}

/**
 * TSX 위치가 `<identifier>.<word>` 형태의 CSS Module 참조인지 확인하고,
 * 그 단어/범위/identifier를 함께 반환한다. 아니면 undefined.
 */
function resolveStyleRefAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
): { word: string; range: vscode.Range; identifier: string } | undefined {
    const identifier = getCssModuleImportIdentifier(document);
    if (identifier == null) {
        return undefined;
    }

    const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_][a-zA-Z0-9_]*/);
    if (wordRange == null) {
        return undefined;
    }

    const prefixLength = identifier.length + 1; // identifier + '.'
    const prefixCol = wordRange.start.character - prefixLength;
    if (prefixCol < 0) {
        return undefined;
    }

    const prefixRange = new vscode.Range(
        new vscode.Position(wordRange.start.line, prefixCol),
        wordRange.start
    );
    if (document.getText(prefixRange) !== `${identifier}.`) {
        return undefined;
    }

    return {
        word: document.getText(wordRange),
        range: wordRange,
        identifier,
    };
}

/**
 * TSX의 `styles.foo` 위에 호버 시 대응하는 CSS Module 룰 블록을 보여준다.
 */
async function provideStyleHover(
    document: vscode.TextDocument,
    position: vscode.Position
): Promise<vscode.Hover | undefined> {
    const ref = resolveStyleRefAtPosition(document, position);
    if (ref == null) {
        return undefined;
    }

    const cssUri = await findCssModuleForTsx(document.uri);
    if (cssUri == null) {
        return undefined;
    }
    const cssDocument = await vscode.workspace.openTextDocument(cssUri);

    const blocks = extractRuleBlocks(cssDocument.getText(), ref.word);
    if (blocks.length === 0) {
        return undefined;
    }

    const codeLang = cssDocument.languageId === 'scss' ? 'scss' : 'css';
    const md = new vscode.MarkdownString();
    md.isTrusted = false;
    blocks.forEach((block, i) => {
        if (i > 0) {
            md.appendMarkdown('\n\n---\n\n');
        }
        md.appendCodeblock(block, codeLang);
    });

    return new vscode.Hover(md, ref.range);
}

/**
 * TSX의 `styles.foo`에 Ctrl+Click 시 SCSS의 `.foo` 선언 위치로 점프할 수 있게 해준다.
 * (TypeScript 기본 정의 — `*.module.scss` 모듈 선언 — 와 함께 후보로 표시됨)
 */
async function provideStyleDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
): Promise<vscode.Definition | undefined> {
    const ref = resolveStyleRefAtPosition(document, position);
    if (ref == null) {
        return undefined;
    }

    const cssUri = await findCssModuleForTsx(document.uri);
    if (cssUri == null) {
        return undefined;
    }
    const cssDocument = await vscode.workspace.openTextDocument(cssUri);

    const ranges = findClassRanges(cssDocument, ref.word);
    if (ranges.length === 0) {
        return undefined;
    }

    return ranges.map(range => new vscode.Location(cssUri, range));
}

/**
 * 활성 에디터의 언어에 따라 TSX→CSS / CSS→TSX 방향으로 분기한다.
 */
async function updateHighlight(editor: vscode.TextEditor): Promise<void> {
    clearAllHighlights();
    if (highlightDecoration == null) {
        return;
    }

    const language = editor.document.languageId as SourceLanguage;
    if (SUPPORTED_LANGUAGES.has(language) === false) {
        return;
    }

    if (JSX_LANGUAGES.has(language)) {
        await highlightFromTsx(editor, highlightDecoration);
        return;
    }

    // css | scss
    await highlightFromCss(editor, highlightDecoration);
}

/**
 * TSX 커서 위치의 JSX className → 대응하는 CSS Module의 클래스 정의를 함께 강조.
 *
 * Flow:
 *  1) CSS Module import identifier 추출 (예: `styles`)
 *  2) 커서가 위치한 JSX의 className 수집
 *  3) 같은 디렉터리의 `.module.css` / `.module.scss` 파일 탐색
 *  4) 해당 CSS 파일이 열린 에디터가 있는지 확인 (없으면 종료)
 *  5) CSS / TSX 양쪽에 decoration 적용
 */
async function highlightFromTsx(
    tsxEditor: vscode.TextEditor,
    decoration: vscode.TextEditorDecorationType
): Promise<void> {
    const document = tsxEditor.document;
    const cursorPosition = tsxEditor.selection.active;

    // (1) Resolve CSS module import identifier
    const identifier = getCssModuleImportIdentifier(document);
    if (identifier == null) {
        return;
    }

    // (2) Collect classNames at cursor
    const classNames = getCurrentClassNames(document, cursorPosition, identifier);
    if (classNames.length === 0) {
        return;
    }

    // (3) Locate matching CSS module file
    const cssUri = await findCssModuleForTsx(document.uri);
    if (cssUri == null) {
        return;
    }

    // (4) Require the CSS file to be open in a visible editor
    const cssEditor = vscode.window.visibleTextEditors.find(
        editor => editor.document.uri.toString() === cssUri.toString()
    );
    if (cssEditor == null) {
        return;
    }

    // (5) Apply decorations
    const cssRanges = classNames.flatMap(
        className => findClassRanges(cssEditor.document, className)
    );
    if (cssRanges.length > 0) {
        cssEditor.setDecorations(decoration, cssRanges);
    }

    const tsxRanges = findStyleRefsInTsx(document, classNames, identifier);
    if (tsxRanges.length > 0) {
        tsxEditor.setDecorations(decoration, tsxRanges);
    }
}

/**
 * CSS/SCSS 커서 위치의 클래스명 → 대응하는 TSX의 `styles.xxx` 참조를 함께 강조.
 *
 * Flow:
 *  1) 커서가 가리키는 클래스명 추출 (`.foo` 위에 있어야 함)
 *  2) 같은 basename의 TSX 파일 탐색
 *  3) TSX 파일이 열린 에디터가 있는지 확인 (없으면 종료)
 *  4) TSX의 CSS Module import identifier 확인
 *  5) CSS / TSX 양쪽에 decoration 적용
 */
async function highlightFromCss(
    cssEditor: vscode.TextEditor,
    decoration: vscode.TextEditorDecorationType
): Promise<void> {
    const cssDocument = cssEditor.document;
    const cursorPosition = cssEditor.selection.active;

    // (1) 커서가 가리키는 클래스명
    const className = getClassNameAtPosition(cssDocument, cursorPosition);
    if (className == null) {
        return;
    }

    // (2) 대응하는 TSX 파일 탐색
    const tsxUri = await findTsxForCssModule(cssDocument.uri);
    if (tsxUri == null) {
        return;
    }

    // (3) TSX 파일이 열린 에디터가 있는지
    const tsxEditor = vscode.window.visibleTextEditors.find(
        editor => editor.document.uri.toString() === tsxUri.toString()
    );
    if (tsxEditor == null) {
        return;
    }

    // (4) TSX의 import identifier 확인
    const identifier = getCssModuleImportIdentifier(tsxEditor.document);
    if (identifier == null) {
        return;
    }

    // (5) Apply decorations
    const cssRanges = findClassRanges(cssDocument, className);
    if (cssRanges.length > 0) {
        cssEditor.setDecorations(decoration, cssRanges);
    }

    const tsxRanges = findStyleRefsInTsx(tsxEditor.document, [className], identifier);
    if (tsxRanges.length > 0) {
        tsxEditor.setDecorations(decoration, tsxRanges);
    }
}

export function deactivate() {
    if (selectionDebounceTimer != null) {
        clearTimeout(selectionDebounceTimer);
        selectionDebounceTimer = undefined;
    }
    disposeDecoration();
}
