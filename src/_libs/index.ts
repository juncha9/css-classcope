import * as vscode from 'vscode';
import * as path from 'path';
import * as ts from 'typescript';

// ---------------------------------------------------------------------------
// regex
// ---------------------------------------------------------------------------

export function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// color
// ---------------------------------------------------------------------------

// rgba(...) 색상의 alpha를 지정 값으로 교체한다. 파싱 실패 시 원래 색을 그대로 사용한다.
export function withAlpha(color: string, alpha: number): string {
    const match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/.exec(color);
    if (match == null) {
        return color;
    }
    const [, r, g, b] = match;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// css-finder
// ---------------------------------------------------------------------------

/**
 * 후보 경로 목록에서 실제로 존재하는 파일을 찾아 Uri를 반환한다.
 * 열린 탭 우선, 없으면 파일시스템 stat 시도. 모두 실패하면 undefined.
 */
async function findUriFromCandidates(candidates: string[]): Promise<vscode.Uri | undefined> {
    // (1) 열려있는 탭에서 먼저 찾기
    for (const tabGroup of vscode.window.tabGroups.all) {
        for (const tab of tabGroup.tabs) {
            if (tab.input instanceof vscode.TabInputText) {
                if (candidates.includes(tab.input.uri.fsPath)) {
                    return tab.input.uri;
                }
            }
        }
    }

    // (2) 파일시스템에서 찾기
    for (const candidate of candidates) {
        const uri = vscode.Uri.file(candidate);
        try {
            await vscode.workspace.fs.stat(uri);
            return uri;
        } catch {
            // 파일 없음, 다음 후보 시도
        }
    }

    return undefined;
}

/**
 * TSX 파일 경로에 대응하는 CSS Module 파일을 찾는다.
 */
export function findCssModuleForTsx(tsxUri: vscode.Uri): Promise<vscode.Uri | undefined> {
    const dir = path.dirname(tsxUri.fsPath);
    const baseName = path.basename(tsxUri.fsPath, path.extname(tsxUri.fsPath));
    return findUriFromCandidates([
        path.join(dir, `${baseName}.module.css`),
        path.join(dir, `${baseName}.module.scss`),
    ]);
}

/**
 * CSS Module 파일 경로에 대응하는 TSX 파일을 찾는다.
 */
export function findTsxForCssModule(cssUri: vscode.Uri): Promise<vscode.Uri | undefined> {
    const dir = path.dirname(cssUri.fsPath);
    const fileName = path.basename(cssUri.fsPath);

    const match = /^(.+)\.module\.(css|scss)$/.exec(fileName);
    if (match == null) {
        return Promise.resolve(undefined);
    }
    const baseName = match[1];

    return findUriFromCandidates([
        path.join(dir, `${baseName}.tsx`),
        path.join(dir, `${baseName}.jsx`),
    ]);
}

/**
 * CSS/SCSS 문서에서 커서 위치가 가리키는 클래스명을 반환한다.
 * 커서가 `.className` 위에 있지 않으면 undefined.
 */
export function getClassNameAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
): string | undefined {
    const offset = document.offsetAt(position);
    const text = document.getText();
    const pattern = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (start <= offset && offset <= end) {
            return match[1];
        }
    }
    return undefined;
}

/**
 * CSS/SCSS 문서에서 특정 클래스명의 룰 블록 전체(셀렉터 + 중괄호 본문)을 문자열로 추출한다.
 * 같은 클래스명이 여러 번 정의되어 있으면 모두 반환한다.
 *
 * 동작:
 *  1) `.className` 위치를 모두 찾고
 *  2) 각 위치에서 뒤로 걸으며 셀렉터 시작점(직전 `}`/`{`/`;` 다음)을 잡고
 *  3) 앞으로 걸으며 균형이 맞는 `}`까지를 한 블록으로 슬라이스한다.
 */
export function extractRuleBlocks(text: string, className: string): string[] {
    const blocks: string[] = [];
    const startPattern = new RegExp(
        `\\.${escapeRegex(className)}(?=[\\s,{:.&#>+~\\[\\)])`,
        'g'
    );

    let match: RegExpExecArray | null;
    while ((match = startPattern.exec(text)) !== null) {
        // (1) 셀렉터 시작점: 직전 `}`/`{`/`;` 다음, 없으면 0
        let selectorStart = 0;
        for (let i = match.index - 1; i >= 0; i--) {
            const ch = text[i];
            if (ch === '}' || ch === '{' || ch === ';') {
                selectorStart = i + 1;
                break;
            }
        }

        // (2) 매칭 이후의 첫 `{` 위치
        const braceStart = text.indexOf('{', match.index);
        if (braceStart === -1) {
            continue;
        }

        // (3) 균형 맞는 `}` 찾기
        let depth = 1;
        let cursor = braceStart + 1;
        while (cursor < text.length && depth > 0) {
            const ch = text[cursor];
            if (ch === '{') {
                depth++;
            } else if (ch === '}') {
                depth--;
            }
            cursor++;
        }

        if (depth === 0) {
            blocks.push(text.slice(selectorStart, cursor).trim());
        }
    }

    return blocks;
}

/**
 * CSS/SCSS 문서에서 특정 클래스명의 범위들을 찾는다.
 * e.g. className = "container" → .container { ... } 블록들
 */
export function findClassRanges(document: vscode.TextDocument, className: string): vscode.Range[] {
    const ranges: vscode.Range[] = [];
    const text = document.getText();
    const pattern = new RegExp(`\\.${escapeRegex(className)}(?=[\\s{:.,&#>+~\\[\\)])`, 'g');

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        ranges.push(new vscode.Range(startPos, endPos));
    }

    return ranges;
}

// ---------------------------------------------------------------------------
// tsx-parser
// ---------------------------------------------------------------------------

/**
 * TSX 파일이 CSS Module을 import하고 있는지 확인하고,
 * import된 identifier 이름을 반환한다.
 */
export function getCssModuleImportIdentifier(document: vscode.TextDocument): string | undefined {
    const text = document.getText();
    const importPattern = /import\s+(\w+)\s+from\s+['"][^'"]*\.module\.(css|scss)['"]/;
    const match = importPattern.exec(text);
    return match ? match[1] : undefined;
}

// (uri, version) 단위 SourceFile 캐시. 매 selection 이벤트마다 재파싱하지 않도록.
const sourceFileCache = new Map<string, { version: number; sourceFile: ts.SourceFile }>();

function getSourceFile(document: vscode.TextDocument): ts.SourceFile {
    const key = document.uri.toString();
    const cached = sourceFileCache.get(key);
    if (cached != null && cached.version === document.version) {
        return cached.sourceFile;
    }
    const scriptKind = document.languageId === 'javascriptreact'
        ? ts.ScriptKind.JSX
        : ts.ScriptKind.TSX;
    const sourceFile = ts.createSourceFile(
        document.fileName,
        document.getText(),
        ts.ScriptTarget.Latest,
        true,
        scriptKind
    );
    sourceFileCache.set(key, { version: document.version, sourceFile });
    return sourceFile;
}

/**
 * 커서 위치를 포함하는 가장 안쪽 JSX 엘리먼트의 className들을 반환한다.
 */
export function getCurrentClassNames(
    document: vscode.TextDocument,
    position: vscode.Position,
    identifier: string
): string[] {
    const offset = document.offsetAt(position);
    const sourceFile = getSourceFile(document);

    let innermostJsx: ts.JsxElement | ts.JsxSelfClosingElement | undefined;

    function findNode(node: ts.Node): void {
        if (node.pos <= offset && offset <= node.end) {
            if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
                innermostJsx = node;
            }
            ts.forEachChild(node, findNode);
        }
    }

    findNode(sourceFile);
    if (innermostJsx == null) {
        return [];
    }

    const attrs = ts.isJsxElement(innermostJsx)
        ? innermostJsx.openingElement.attributes
        : innermostJsx.attributes;

    return collectClassNamesFromNode(attrs, sourceFile, identifier);
}

/**
 * 주어진 노드 서브트리에서 모든 className의 identifier.XXX 패턴을 수집한다.
 */
function collectClassNamesFromNode(
    root: ts.Node,
    sourceFile: ts.SourceFile,
    identifier: string
): string[] {
    const classNames = new Set<string>();
    const pattern = new RegExp(`${escapeRegex(identifier)}\\.([a-zA-Z_][a-zA-Z0-9_]*)`, 'g');

    function visit(node: ts.Node): void {
        if (ts.isJsxAttribute(node)) {
            const attrName = node.name.getText(sourceFile);
            if (attrName === 'className' && node.initializer) {
                const text = node.initializer.getText(sourceFile);
                pattern.lastIndex = 0;
                let match: RegExpExecArray | null;
                while ((match = pattern.exec(text)) !== null) {
                    classNames.add(match[1]);
                }
            }
        }
        ts.forEachChild(node, visit);
    }

    visit(root);
    return [...classNames];
}

/**
 * TSX 문서 전체에서 `identifier.<className>` 형태의 참조 위치를 찾는다.
 */
export function findStyleRefsInTsx(
    document: vscode.TextDocument,
    classNames: string[],
    identifier: string
): vscode.Range[] {
    if (classNames.length === 0) {
        return [];
    }
    const text = document.getText();
    const ranges: vscode.Range[] = [];
    for (const className of classNames) {
        const pattern = new RegExp(
            `${escapeRegex(identifier)}\\.${escapeRegex(className)}(?![a-zA-Z0-9_])`,
            'g'
        );
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
