<!-- ladder: rung-3 — публичный README одноразового репозитория-шутки; не системное знание GDEV -->
# fly-to-msk ✈️

Шуточный одностраничник: глобус в космосе, Лимасол → Москва, парабола с пульсами
и обратный отсчёт до **31 июля 2026, 19:10 (МСК)**.

- 3D-глобус — [globe.gl](https://globe.gl) (Three.js), спутниковые тайлы Sentinel-2 cloudless (EOX)
- Парабола и пульсы — canvas-оверлей поверх глобуса, синхронизированы с секундным тиком
- Без сборки: `index.html` + `css/` + `js/`, хостится на GitHub Pages

Локально: `python3 -m http.server --directory . 4620` → http://localhost:4620

Аватарки: `assets/avatar-limassol.jpg` и `assets/avatar-moscow.jpg`
(если файлов нет, страница показывает плейсхолдеры).
