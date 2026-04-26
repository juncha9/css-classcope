# CSS Classcope 🔬

> Bidirectionally connects TSX / JSX and CSS Modules. Place your cursor on one side, and its counterpart on the other side is highlighted automatically.

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
