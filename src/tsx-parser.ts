import * as vscode from 'vscode';
import * as ts from 'typescript';

/**
 * TSX 파일이 CSS Module을 import하고 있는지 확인하고,
 * import된 identifier 이름을 반환합니다.
 */
export function getCssModuleImportIdentifier(document: vscode.TextDocument): string | undefined {
    const text = document.getText();
    const importPattern = /import\s+(\w+)\s+from\s+['"][^'"]*\.module\.(css|scss)['"]/;
    const match = importPattern.exec(text);
    return match ? match[1] : undefined;
}

/**
 * 커서 위치를 포함하는 JSX 엘리먼트의 className에서
 * identifier.XXX 클래스명만 추출합니다. (자식 추적 없음)
 *
 * 예: 커서가 <div className={clsx(styles.panel, styles.active)}> 위에 있으면
 * → ['panel', 'active']
 */
export function getClassNamesAtElement(
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

    // 커서를 포함하는 가장 작은 JSX 엘리먼트 찾기
    let innermostJsx: ts.JsxElement | ts.JsxSelfClosingElement | undefined;

    function findInnermost(node: ts.Node): void {
        if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) &&
            node.pos <= offset && offset <= node.end) {
            innermostJsx = node as ts.JsxElement | ts.JsxSelfClosingElement;
        }
        ts.forEachChild(node, findInnermost);
    }

    findInnermost(sourceFile);
    if (!innermostJsx) { return []; }

    // 해당 엘리먼트의 attributes만 스캔 (자식 제외)
    const openingAttrs = ts.isJsxElement(innermostJsx)
        ? innermostJsx.openingElement.attributes
        : innermostJsx.attributes;

    return collectClassNamesFromNode(openingAttrs, sourceFile, identifier);
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
