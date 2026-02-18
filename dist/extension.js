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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const css_finder_1 = require("./css-finder");
const tsx_parser_1 = require("./tsx-parser");
let highlightDecoration;
function createHighlightDecoration() {
    const config = vscode.workspace.getConfiguration('styleCompass');
    const color = config.get('highlightColor', 'rgba(255, 200, 0, 0.3)');
    return vscode.window.createTextEditorDecorationType({
        backgroundColor: color,
        border: '1px solid rgba(255, 200, 0, 0.6)',
        borderRadius: '2px',
    });
}
function activate(context) {
    highlightDecoration = createHighlightDecoration();
    // 설정 변경 시 decoration 재생성
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('styleCompass.highlightColor')) {
            highlightDecoration?.dispose();
            highlightDecoration = createHighlightDecoration();
        }
    }));
    // 커서 위치 변경 감지
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(async (event) => {
        const editor = event.textEditor;
        if (editor.document.languageId !== 'typescriptreact') {
            return;
        }
        await updateHighlight(editor);
    }));
    // 활성 에디터 변경 감지
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (!editor || editor.document.languageId !== 'typescriptreact') {
            clearAllHighlights();
            return;
        }
        await updateHighlight(editor);
    }));
    // 현재 에디터가 TSX이면 즉시 실행
    const active = vscode.window.activeTextEditor;
    if (active?.document.languageId === 'typescriptreact') {
        updateHighlight(active);
    }
}
async function updateHighlight(tsxEditor) {
    clearAllHighlights();
    const position = tsxEditor.selection.active;
    const document = tsxEditor.document;
    // import identifier 찾기 (styles, cls 등)
    const identifier = (0, tsx_parser_1.getCssModuleImportIdentifier)(document);
    if (!identifier) {
        return;
    }
    // 커서 위치에서 클래스명 추출
    const className = (0, tsx_parser_1.getClassNameAtCursorWithIdentifier)(document, position, identifier);
    if (!className) {
        return;
    }
    // 대응하는 CSS Module 파일 찾기
    const cssUri = await (0, css_finder_1.findCssModuleForTsx)(document.uri);
    if (!cssUri) {
        return;
    }
    // CSS 파일의 탭 에디터를 가져오거나 열기
    const cssDocument = await vscode.workspace.openTextDocument(cssUri);
    // 하이라이트할 범위 찾기
    const ranges = (0, css_finder_1.findClassRanges)(cssDocument, className);
    if (ranges.length === 0) {
        return;
    }
    // 현재 열려있는 CSS 에디터에 하이라이트 적용
    // CSS 파일이 열려있는 탭의 에디터를 찾기
    const cssEditor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === cssUri.toString());
    if (cssEditor && highlightDecoration) {
        cssEditor.setDecorations(highlightDecoration, ranges);
        // 첫 번째 매칭 위치로 reveal (스크롤)
        cssEditor.revealRange(ranges[0], vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    }
    else {
        // CSS 파일이 보이지 않으면 옆에 열기
        await vscode.window.showTextDocument(cssUri, {
            viewColumn: vscode.ViewColumn.Beside,
            preserveFocus: true,
            preview: false,
        });
        // 열린 후 하이라이트 적용
        const newCssEditor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === cssUri.toString());
        if (newCssEditor && highlightDecoration) {
            newCssEditor.setDecorations(highlightDecoration, ranges);
            newCssEditor.revealRange(ranges[0], vscode.TextEditorRevealType.InCenterIfOutsideViewport);
        }
    }
}
function clearAllHighlights() {
    if (!highlightDecoration) {
        return;
    }
    for (const editor of vscode.window.visibleTextEditors) {
        editor.setDecorations(highlightDecoration, []);
    }
}
function deactivate() {
    highlightDecoration?.dispose();
}
//# sourceMappingURL=extension.js.map