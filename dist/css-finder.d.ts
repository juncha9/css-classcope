import * as vscode from 'vscode';
/**
 * TSX 파일 경로에 대응하는 CSS Module 파일을 찾습니다.
 * 열려있는 탭 중에서 먼저 찾고, 없으면 파일시스템에서 찾습니다.
 */
export declare function findCssModuleForTsx(tsxUri: vscode.Uri): Promise<vscode.Uri | undefined>;
/**
 * CSS/SCSS 문서에서 특정 클래스명의 범위들을 찾습니다.
 * e.g. className = "container" → .container { ... } 블록들
 */
export declare function findClassRanges(document: vscode.TextDocument, className: string): vscode.Range[];
