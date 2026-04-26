import { SourceLanguage } from '../_types';

export const SELECTION_DEBOUNCE_MS = 120;

export const DEFAULT_HIGHLIGHT_COLOR = 'rgba(255, 200, 0, 0.3)';

// outline / overview ruler 등 강조 요소에 쓰일 alpha
export const OUTLINE_ALPHA = 0.95;
// 배경에 쓰일 alpha (사용자 설정값과 무관하게 일정 가시성 보장)
export const BACKGROUND_ALPHA = 0.3;

export const SUPPORTED_LANGUAGES: ReadonlySet<SourceLanguage> = new Set<SourceLanguage>([
    'typescriptreact',
    'javascriptreact',
    'css',
    'scss',
]);

export const JSX_LANGUAGES: ReadonlySet<SourceLanguage> = new Set<SourceLanguage>([
    'typescriptreact',
    'javascriptreact',
]);
