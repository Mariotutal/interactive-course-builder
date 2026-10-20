# PROGRESS

Estado: **completo** (curso de 7 lecciones: 6 básicas + 1 avanzada, diagnóstico de 5 preguntas y tarea final con rúbrica). Fecha: 2026-10-20.

## Hecho
- `request.json`, `course.json` (6 resultados, 3 módulos, rutas básica y avanzada, glosario de 17 términos, diagnóstico, capstone).
- Lecciones: `variabilidad-datos`, `media-muestral`, `construir-intervalo`, `interpretar-intervalo`, `encuestas-margen`, `test-ab`, `planificar-supuestos` (avanzada).
- Widget propio `widgets/sampling-sim.js` (simulador de muestreo con semilla, cobertura de intervalos, `aria-live`, teclado, `api.record`).
- `validate`: 0 errores, 0 avisos. `build`: OK (`site/`, `markdown/`, `COVERAGE.md`). `REVIEW.md` escrito.

## Pendiente / siguiente paso exacto
- Probar con una persona real; medir el tiempo de las lecciones 5 y 6.
- Probar exportar/importar progreso, glosario por teclado, impresión y modo oscuro.
- Verificar el texto de OpenIntro Statistics (cap. 5 y dos proporciones) y sustituir las notas «verify».
- Probar los nombres de funciones en la hoja de cálculo real de la persona.

## Notas de autoría
- El validador marca como «placeholder» cualquier palabra «todo» y, por usar `\b` ASCII, también «método» (por la sílaba «todo» tras la «é»). Se reformuló el texto (procedimiento, intervalo z/t, «entero»…). Si se edita el curso, evita esas palabras o corrige el validador.
- Para regenerar: las lecciones son JSON a mano; no hay generador en la carpeta.
