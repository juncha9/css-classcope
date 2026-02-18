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

export interface ThreeLevelClassNames {
    parent: string[];   // 상위 1레벨 엘리먼트의 className들
    current: string[];  // 커서 위치 엘리먼트의 className들
    children: string[]; // 직접 자식 엘리먼트들의 className들 (모두 한 그룹)
}

/**
 * 커서 위치 기준으로 상위 1개 / 현재 / 하위 1레벨의 className을 반환합니다.
 *
 * 예:
 *   <section className={styles.wrapper}>       ← parent (🔵)
 *     <div className={styles.panel}>           ← current (🟡) ← 커서
 *       <h3 className={styles.title}/>         ← children (🟢)
 *       <p className={styles.body}/>           ← children (🟢)
 *     </div>
 *   </section>
 */
export function getThreeLevelClassNames(
    document: vscode.TextDocument,
    position: vscode.Position,
    identifier: string
): ThreeLevelClassNames {
    const empty: ThreeLevelClassNames = { parent: [], current: [], children: [] };
    const sourceText = document.getText();
    const offset = document.offsetAt(position);

    const sourceFile = ts.createSourceFile(
        document.fileName,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
    );

    // 커서를 포함하는 가장 작은 JSX 엘리먼트와 그 직접 부모 찾기
    let innermostJsx: ts.JsxElement | ts.JsxSelfClosingElement | undefined;
    let parentJsx: ts.JsxElement | ts.JsxSelfClosingElement | undefined;

    function findNodes(node: ts.Node, lastJsx?: ts.JsxElement | ts.JsxSelfClosingElement): void {
        const isJsx = ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node);
        if (node.pos <= offset && offset <= node.end) {
            if (isJsx) {
                parentJsx = lastJsx;
                innermostJsx = node as ts.JsxElement | ts.JsxSelfClosingElement;
                ts.forEachChild(node, child => findNodes(child, innermostJsx));
            } else {
                ts.forEachChild(node, child => findNodes(child, lastJsx));
            }
        }
    }

    findNodes(sourceFile);
    if (!innermostJsx) { return empty; }

    // 현재 엘리먼트 className
    const currentAttrs = ts.isJsxElement(innermostJsx)
        ? innermostJsx.openingElement.attributes
        : innermostJsx.attributes;
    const current = collectClassNamesFromNode(currentAttrs, sourceFile, identifier);

    // 부모 엘리먼트 className
    let parent: string[] = [];
    if (parentJsx) {
        const parentAttrs = ts.isJsxElement(parentJsx)
            ? parentJsx.openingElement.attributes
            : parentJsx.attributes;
        parent = collectClassNamesFromNode(parentAttrs, sourceFile, identifier);
    }

    // 직접 자식 엘리먼트들의 className (하위 1레벨만, 모두 한 그룹)
    const childNames = new Set<string>();
    if (ts.isJsxElement(innermostJsx)) {
        for (const child of innermostJsx.children) {
            if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
                const attrs = ts.isJsxElement(child)
                    ? child.openingElement.attributes
                    : child.attributes;
                collectClassNamesFromNode(attrs, sourceFile, identifier)
                    .forEach(n => childNames.add(n));
            }
        }
    }

    return { parent, current, children: [...childNames] };
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
