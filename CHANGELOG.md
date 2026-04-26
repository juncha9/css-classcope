# Changelog

## [0.1.1] - 2026-04-27

### Changed
- Updated extension icon
- Reorganized source layout
- Updated README and documentation images

## [0.1.0] - 2026-04-26

### Added
- Initial release
- **TSX / JSX → CSS Module** highlight: when the cursor is on a `styles.foo` reference in a `.tsx` or `.jsx` file, the matching `.foo` declaration in the sibling `*.module.css` / `*.module.scss` file is highlighted
- **CSS Module → TSX / JSX** highlight: when the cursor is on a `.foo` class declaration in a CSS Module file, all `styles.foo` references in the sibling `.tsx` / `.jsx` file are highlighted (`.tsx` is preferred when both siblings exist)
- **Hover preview**: hovering a `styles.foo` reference in a `.tsx` / `.jsx` file shows the matching CSS rule body as a popup (works even when the CSS file is not open)
- **Go to Definition**: `Ctrl+Click` (or `F12`) on a `styles.foo` reference jumps to the matching `.foo` declaration in the CSS Module file
- Configurable highlight color via `cssClasscope.highlightColor` (background, outline, and overview-ruler marker share the same color)
- Overview ruler markers so matches are visible even when scrolled out of view
- Support for both `.module.css` and `.module.scss` companion files
- TypeScript AST-based JSX parsing with per-document caching for low-overhead cursor tracking
- Selection-event debouncing (120ms) to avoid redundant work during rapid cursor movement
