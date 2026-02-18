"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.findCssModuleForTsx = findCssModuleForTsx;
exports.findClassRanges = findClassRanges;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * TSX 파일 경로에 대응하는 CSS Module 파일을 찾습니다.
 * 열려있는 탭 중에서 먼저 찾고, 없으면 파일시스템에서 찾습니다.
 */
async function findCssModuleForTsx(tsxUri) {
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
        }
        catch {
            // 파일 없음, 다음 시도
        }
    }
    return undefined;
}
/**
 * CSS/SCSS 문서에서 특정 클래스명의 범위들을 찾습니다.
 * e.g. className = "container" → .container { ... } 블록들
 */
function findClassRanges(document, className) {
    const ranges = [];
    const text = document.getText();
    // .className 혹은 .className: (pseudo) 혹은 .className. (chained) 매칭
    // 클래스 선언 패턴: `.className` 뒤에 공백, {, :, . 등이 오는 경우
    const pattern = new RegExp(`\\.${escapeRegex(className)}(?=[\\s{:.,&#>+~\\[\\)])`, 'g');
    let match;
    while ((match = pattern.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        ranges.push(new vscode.Range(startPos, endPos));
    }
    return ranges;
}
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
//# sourceMappingURL=css-finder.js.map