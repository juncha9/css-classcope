import * as vscode from 'vscode';
/**
 * 커서 위치에서 CSS Module 클래스 참조를 찾습니다.
 *
 * 지원 패턴:
 *   className={styles.container}
 *   className={styles.container + ' ...'}
 *   className={`${styles.container} ...`}
 *   className="styles.container"  (드문 경우)
 */
export declare function getClassNameAtCursor(document: vscode.TextDocument, position: vscode.Position): string | undefined;
/**
 * TSX 파일이 CSS Module을 import하고 있는지 확인하고,
 * import된 identifier 이름을 반환합니다.
 *
 * e.g. import styles from './Button.module.css' → 'styles'
 * e.g. import cls from './Button.module.scss' → 'cls'
 */
export declare function getCssModuleImportIdentifier(document: vscode.TextDocument): string | undefined;
/**
 * 특정 identifier(e.g. 'styles')로 커서 위치의 클래스명을 찾습니다.
 */
export declare function getClassNameAtCursorWithIdentifier(document: vscode.TextDocument, position: vscode.Position, identifier: string): string | undefined;
