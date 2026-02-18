"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClassNameAtCursor = getClassNameAtCursor;
exports.getCssModuleImportIdentifier = getCssModuleImportIdentifier;
exports.getClassNameAtCursorWithIdentifier = getClassNameAtCursorWithIdentifier;
/**
 * 커서 위치에서 CSS Module 클래스 참조를 찾습니다.
 *
 * 지원 패턴:
 *   className={styles.container}
 *   className={styles.container + ' ...'}
 *   className={`${styles.container} ...`}
 *   className="styles.container"  (드문 경우)
 */
function getClassNameAtCursor(document, position) {
    const line = document.lineAt(position.line).text;
    const col = position.character;
    // 커서 주변 토큰 추출 (styles.XXX 패턴)
    // 정규식으로 현재 커서가 styles.XXX 위에 있는지 확인
    const stylesPattern = /styles\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let match;
    while ((match = stylesPattern.exec(line)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;
        if (col >= start && col <= end) {
            return match[1]; // 클래스명 반환
        }
    }
    return undefined;
}
/**
 * TSX 파일이 CSS Module을 import하고 있는지 확인하고,
 * import된 identifier 이름을 반환합니다.
 *
 * e.g. import styles from './Button.module.css' → 'styles'
 * e.g. import cls from './Button.module.scss' → 'cls'
 */
function getCssModuleImportIdentifier(document) {
    const text = document.getText();
    // import XXX from '...module.css' or '...module.scss'
    const importPattern = /import\s+(\w+)\s+from\s+['"][^'"]*\.module\.(css|scss)['"]/;
    const match = importPattern.exec(text);
    return match ? match[1] : undefined;
}
/**
 * 특정 identifier(e.g. 'styles')로 커서 위치의 클래스명을 찾습니다.
 */
function getClassNameAtCursorWithIdentifier(document, position, identifier) {
    const line = document.lineAt(position.line).text;
    const col = position.character;
    const pattern = new RegExp(`${escapeRegex(identifier)}\\.([a-zA-Z_][a-zA-Z0-9_]*)`, 'g');
    let match;
    while ((match = pattern.exec(line)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;
        if (col >= start && col <= end) {
            return match[1];
        }
    }
    return undefined;
}
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
//# sourceMappingURL=tsx-parser.js.map