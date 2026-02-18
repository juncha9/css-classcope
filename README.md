# Style Compass 🧭

> TSX 파일에서 커서를 CSS Module 클래스 참조 위에 올리면, 대응하는 CSS/SCSS 파일에서 해당 클래스를 자동으로 하이라이트합니다.

## 기능

- `.tsx` 파일에서 `styles.className` 패턴 커서 감지
- 같은 이름의 `.module.css` 또는 `.module.scss` 파일 자동 탐색
- 대응하는 CSS 클래스 정의를 하이라이트 & 자동 스크롤
- CSS 파일이 열려있지 않으면 옆에 자동으로 열어줌

## 지원 패턴

```tsx
import styles from './Button.module.css'; // 또는 .module.scss

// 아래 패턴들에서 커서를 올리면 CSS 클래스 하이라이트
<div className={styles.container}>
<button className={styles.primaryBtn}>
<span className={`${styles.icon} ${styles.active}`}>
```

## 설정

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `styleCompass.highlightColor` | `rgba(255, 200, 0, 0.3)` | 하이라이트 배경색 |

## 개발

```bash
npm install
npm run compile
# F5로 Extension Development Host 실행
```
