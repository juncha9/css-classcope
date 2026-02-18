import * as vscode from 'vscode';

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
 * 커서가 포함된 { } JSX 표현식 블록 안의 모든 identifier.XXX 클래스명을 반환합니다.
 *
 * 지원 패턴 (블록 내 어디에 커서가 있든 전부 추출):
 *   className={styles.container}
 *   className={clsx(styles.panel, styles.panel_full)}
 *   className={cn(styles.base, isActive && styles.active)}
 *   className={classnames(styles.a, styles.b, styles.c)}
 *   className={`${styles.a} ${styles.b}`}
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

    // 블록 안의 모든 identifier.XXX 추출
    const blockContent = line.substring(blockStart, blockEnd + 1);
    const pattern = new RegExp(`${escapeRegex(identifier)}\\.([a-zA-Z_][a-zA-Z0-9_]*)`, 'g');
    const classNames: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(blockContent)) !== null) {
        classNames.push(match[1]);
    }

    return classNames;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
