# CSS Classcope 🔬

[![VS Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/alkemic-studio.css-classcope?color=007ACC&logo=visual-studio-code&label=marketplace)](https://marketplace.visualstudio.com/items?itemName=alkemic-studio.css-classcope)
[![VS Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/alkemic-studio.css-classcope?color=informational&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=alkemic-studio.css-classcope)
[![VS Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/alkemic-studio.css-classcope?color=orange&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=alkemic-studio.css-classcope&ssr=false#review-details)
[![GitHub stars](https://img.shields.io/github/stars/juncha9/css-classcope?color=f5d90a&logo=github)](https://github.com/juncha9/css-classcope/stargazers)
[![last commit](https://img.shields.io/github/last-commit/juncha9/css-classcope?color=blueviolet&logo=github)](https://github.com/juncha9/css-classcope/commits/main)
[![license](https://img.shields.io/github/license/juncha9/css-classcope?color=green)](./LICENSE.md)
[![Sponsor](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ea4aaa?logo=github-sponsors)](https://github.com/sponsors/juncha9)
  
> Bidirectionally connects TSX / JSX and CSS Modules. Place your cursor on one side, and its counterpart on the other side is highlighted automatically.
  
![Usage](https://raw.githubusercontent.com/juncha9/css-classcope/main/docs/imgs/usage.gif)
  
## Features

- **TSX / JSX → CSS**: Hover the cursor over a `styles.foo` reference in a TSX or JSX file to highlight the `.foo` definition in the sibling `.module.css` / `.module.scss` file.
- **CSS → TSX / JSX**: Hover the cursor over a `.foo` class definition in a CSS Module file to highlight the `styles.foo` references in the paired TSX / JSX file.
- **Hover preview** 🔍: Hovering `styles.foo` in TSX / JSX shows the matching CSS Module rule body in a popup. Works even when the CSS file is not open.
- **Go to Definition** 🎯: `Ctrl+Click` (or `F12`) on `styles.foo` in TSX / JSX jumps to the `.foo` declaration in the SCSS file.
- **Overview ruler marker**: Even when matches are off-screen, markers on the right side of the scrollbar show their location.

> ⚠️ **Bidirectional highlighting** only works when the counterpart file is already open in a visible editor (it does not open files automatically). The most natural setup is to keep both files side by side in a Split Editor. Hover and Go to Definition work even when the counterpart is closed.

## Supported Patterns

```tsx
import styles from './Button.module.css'; // or .module.scss

// Highlights trigger when the cursor is on the patterns below
<div className={styles.container}>
<button className={styles.primaryBtn}>
<span className={`${styles.icon} ${styles.active}`}>
```

```scss
// Same behavior when the cursor is on the CSS Module side
.container { /* ... */ }
.primaryBtn { /* ... */ }
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `cssClasscope.highlightColor` | `rgba(255, 200, 0, 0.3)` | Highlight color (used for background, outline, and overview ruler) |

## How it works

- TSX / JSX side: Builds a JSX AST with the TypeScript compiler (using `ScriptKind.TSX` for `.tsx` and `ScriptKind.JSX` for `.jsx`) and extracts the `className` of the innermost JSX element under the cursor. The AST is cached per document version, so re-parsing cost is near zero.
- CSS side: Matches `.className` declarations and references with regex. Recognizes SCSS nesting, pseudo-classes, and chained selectors.
- Counterpart files are resolved by the same-directory, same-basename rule (`Button.tsx` / `Button.jsx` ↔ `Button.module.css` / `Button.module.scss`). When both `.tsx` and `.jsx` siblings exist, `.tsx` is preferred.

## Requirements

- VS Code `^1.109.0`
- TSX (`.tsx`) or JSX (`.jsx`) source files
- For bidirectional highlighting, keep both files open in visible editors (Hover / Go to Definition work even when closed).

## Known Limitations

- Only `import styles from '*.module.css'` style default imports are recognized (named imports are not supported).
- Only `.tsx` and `.jsx` extensions are scanned (plain `.ts` / `.js` are not supported).
- Plain CSS outside of CSS Modules is out of scope.

## License

[MIT](./LICENSE.md)
