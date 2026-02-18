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
 * 커서 위치를 포함하는 JSX 엘리먼트의 직접 자식들을 그룹으로 반환합니다.
 * 각 그룹은 하나의 자식 서브트리(자식 + 그 하위 자식들)의 className 목록입니다.
 *
 * 예:
 *   <div>              ← 커서가 여기 있으면
 *     <h3 className={styles.title}/>   ← 그룹 1
 *     <section className={styles.body}>
 *       <span className={styles.text}/> ← 그룹 2 (section 서브트리)
 *     </section>
 *   </div>
 *
 * → [['title'], ['body', 'text']]
 */
export function getChildGroupsAtCursor(
    document: vscode.TextDocument,
    position: vscode.Position,
    identifier: string
): Array<{ classNames: string[] }> {
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

    // 직접 자식 JSX 엘리먼트 추출 (JsxSelfClosingElement는 자식 없음)
    const directChildren: Array<ts.JsxElement | ts.JsxSelfClosingElement> = [];

    if (ts.isJsxElement(innermostJsx)) {
        for (const child of innermostJsx.children) {
            if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
                directChildren.push(child);
            } else if (ts.isJsxExpression(child) && child.expression) {
                // {condition && <Element />} 또는 {a ? <A/> : <B/>} 처리
                collectJsxFromExpression(child.expression, directChildren);
            }
        }
    }

    if (directChildren.length === 0) { return []; }

    // 각 자식 서브트리의 classNames 수집
    return directChildren
        .map(child => ({
            classNames: collectClassNamesFromNode(child, sourceFile, identifier),
        }))
        .filter(g => g.classNames.length > 0);
}

/**
 * JSX 표현식 내부에서 JSX 엘리먼트를 재귀적으로 찾습니다.
 * {condition && <A/>} 또는 {flag ? <A/> : <B/>} 같은 패턴 처리용
 */
function collectJsxFromExpression(
    expr: ts.Expression,
    out: Array<ts.JsxElement | ts.JsxSelfClosingElement>
): void {
    if (ts.isJsxElement(expr) || ts.isJsxSelfClosingElement(expr)) {
        out.push(expr);
    } else if (ts.isBinaryExpression(expr)) {
        collectJsxFromExpression(expr.right, out);
    } else if (ts.isConditionalExpression(expr)) {
        collectJsxFromExpression(expr.whenTrue, out);
        collectJsxFromExpression(expr.whenFalse, out);
    } else if (ts.isParenthesizedExpression(expr)) {
        collectJsxFromExpression(expr.expression, out);
    }
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
