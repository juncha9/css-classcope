import * as vscode from 'vscode';
import * as path from 'path';

/**
 * TSX 파일 경로에 대응하는 CSS Module 파일을 찾습니다.
 * 열려있는 탭 중에서 먼저 찾고, 없으면 파일시스템에서 찾습니다.
 */
export async function findCssModuleForTsx(tsxUri: vscode.Uri): Promise<vscode.Uri | undefined> {
    const tsxPath = tsxUri.fsPath;
    const dir = path.dirname(tsxPath);
    const baseName = path.basename(tsxPath, path.extname(tsxPath)); // e.g. "Button"

    const candidates = [
        path.join(dir, `${baseName}.module.css`),
        path.join(dir, `${baseName}.module.scss`),
    ];

    // 열려있는 탭에서 먼저 찾기
    for (const tabGroup of vscode.window.tabGroups.all) {
        for (const tab of tabGroup.tabs) {
            if (tab.input instanceof vscode.TabInputText) {
                const tabPath = tab.input.uri.fsPath;
                if (candidates.includes(tabPath)) {
                    return tab.input.uri;
                }
            }
        }
    }

    // 파일시스템에서 찾기
    for (const candidate of candidates) {
        const uri = vscode.Uri.file(candidate);
        try {
            await vscode.workspace.fs.stat(uri);
            return uri;
        } catch {
            // 파일 없음, 다음 시도
        }
    }

    return undefined;
}

/**
 * CSS/SCSS 문서에서 특정 클래스명의 범위들을 찾습니다.
 * e.g. className = "container" → .container { ... } 블록들
 */
export function findClassRanges(document: vscode.TextDocument, className: string): vscode.Range[] {
    const ranges: vscode.Range[] = [];
    const text = document.getText();

    // .className 혹은 .className: (pseudo) 혹은 .className. (chained) 매칭
    // 클래스 선언 패턴: `.className` 뒤에 공백, {, :, . 등이 오는 경우
    const pattern = new RegExp(`\\.${escapeRegex(className)}(?=[\\s{:.,&#>+~\\[\\)])`, 'g');
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        ranges.push(new vscode.Range(startPos, endPos));
    }

    return ranges;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
