import * as vscode from 'vscode';
import * as ts from 'typescript';

/**
 * TSX 파일이 CSS Module을 import하고 있는지 확인하고,
 * import된 identifier 이름을 반환합니다.
 *
 * e.g. import styles from './Button.module.css' → 'styles'
 * e.g. import cls from './Button.module.scss' → 'cls'
 */
export function getCssModuleImportIdentifier(document: vscode.TextDocument): string | undefined {
    const text = document.getText();
    const importPattern = /import\s+(\w+)\s+from\s+['"][^'"]*\.module\.(css|scss)['"]/;
    const match = importPattern.exec(text);
    return match ? match[1] : undefined;
}

/**
 * 커서 위치를 포함하는 JSX 엘리먼트의 직접 부모 JSX 서브트리에서
 * 모든 identifier.XXX className 패턴을 추출합니다.
 *
 * 예: <a>              ← 부모 (이 서브트리 전체를 스캔)
 *       <b/>           ← 커서가 여기 있으면
 *       <c/>
 *     </a>
 *
 * → a, b, c 각각의 className 전부 반환
 */
export function getClassNamesInParentJsxBlock(
    document: vscode.TextDocument,
    position: vscode.Position,
    identifier: string
): string[] {
    const sourceText = document.getText();
    const offset = document.offsetAt(position);

    const sourceFile = ts.createSourceFile(
        document.fileName,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
    );

    // 커서를 포함하는 가장 작은 JSX 엘리먼트와 그 직접 부모 JSX 엘리먼트 찾기
    let innermostJsx: ts.Node | undefined;
    let parentJsx: ts.Node | undefined;

    function visit(node: ts.Node, lastJsx?: ts.Node): void {
        const isJsx = ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node);

        if (node.pos <= offset && offset <= node.end) {
            if (isJsx) {
                parentJsx = lastJsx;
                innermostJsx = node;
                // 더 깊은 자식 탐색 (더 작은 JSX 엘리먼트가 있을 수 있음)
                ts.forEachChild(node, child => visit(child, node));
            } else {
                ts.forEachChild(node, child => visit(child, lastJsx));
            }
        }
    }

    visit(sourceFile);

    // 부모가 있으면 부모 서브트리, 없으면 현재 엘리먼트 자체 사용
    const targetBlock = parentJsx ?? innermostJsx;
    if (!targetBlock) { return []; }

    return collectClassNamesFromNode(targetBlock, sourceFile, identifier);
}

/**
 * 커서가 포함된 { } JSX 표현식 블록 안의 모든 identifier.XXX 클래스명을 반환합니다.
 * (정규식 기반 - className 속성 값 위에 커서가 있을 때 사용)
 *
 * 지원 패턴:
 *   className={styles.container}
 *   className={clsx(styles.panel, styles.panel_full)}
 *   className={cn(styles.base, isActive && styles.active)}
 */
export function getClassNamesAtCursor(
    document: vscode.TextDocument,
    position: vscode.Position,
    identifier: string
): string[] {
    const line = document.lineAt(position.line).text;
    const col = position.character;

    // 커서 위치에서 왼쪽으로 스캔 → 가장 가까운 여는 { 찾기
    let blockStart = -1;
    let depth = 0;
    for (let i = col; i >= 0; i--) {
        if (line[i] === '}') { depth++; }
        if (line[i] === '{') {
            if (depth === 0) { blockStart = i; break; }
            depth--;
        }
    }

    if (blockStart === -1) { return []; }

    // blockStart에서 오른쪽으로 스캔 → 대응하는 닫는 } 찾기
    let blockEnd = -1;
    depth = 0;
    for (let i = blockStart; i < line.length; i++) {
        if (line[i] === '{') { depth++; }
        if (line[i] === '}') {
            depth--;
            if (depth === 0) { blockEnd = i; break; }
        }
    }

    if (blockEnd === -1 || col < blockStart || col > blockEnd) { return []; }

    const blockContent = line.substring(blockStart, blockEnd + 1);
    const pattern = new RegExp(`${escapeRegex(identifier)}\\.([a-zA-Z_][a-zA-Z0-9_]*)`, 'g');
    const classNames: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(blockContent)) !== null) {
        classNames.push(match[1]);
    }

    return classNames;
}

/**
 * 주어진 노드 서브트리에서 모든 className의 identifier.XXX 패턴을 수집합니다.
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

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
