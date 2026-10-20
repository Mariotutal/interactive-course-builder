# REVIEW — autorevisión (no es una evaluación independiente)

> Esta revisión la ha escrito el mismo modelo que redactó el curso, aplicando la rúbrica de `quality-rubric.md`. **No demuestra que el curso enseñe bien**; no se ha probado con personas reales. Puntuación 0–2 por criterio y lección.

## Qué se ejecutó y observó

- `lk.mjs validate .`: 0 errores, 0 avisos. `lk.mjs build .`: 0 errores, 0 avisos; `COVERAGE.md` muestra los 6 resultados enseñados y evaluados.
- Navegador (servidor local, Chrome embebido): las 7 lecciones se cargan sin errores de consola; los parameter-explorer devuelven los valores calculados a mano (p. ej., IC 44,14–52,26; ventaja −0,72 a +10,72; diferencia A/B −0,09 a +1,89); el simulador `sampling-sim` extrae muestras, actualiza la región `aria-live`, mantiene el foco en el botón pulsado y da 95/100 y 96/100 con semilla 2026 y 1; clasificar (3/6 con todo «parámetro»), stepper y evidence-case muestran sus controles; sin desbordamiento horizontal a 375 px.
- Comprobaciones numéricas en Node: cuantiles t (2,262 con 9 gl; 2,045 con 29 gl; 12,706 con 1 gl; 4,604 con 4 gl: coinciden con valores tabulados conocidos), cobertura del simulador, todas las cifras de las lecciones y de la rúbrica.

## No probado

- Exportar/importar progreso, ventana emergente del glosario con teclado, vista de impresión, modo oscuro y lectores de pantalla: no se ejercitaron.
- Los nombres de funciones de hoja de cálculo (`DESVEST.M`, `INV.T.2C`, `INV.NORM.ESTAND`, `RAIZ`, `CONTAR` y equivalentes en inglés) no se probaron en ningún programa.
- Sin pruebas con personas aprendices.

## Verificación de fuentes (acceso 2026-10-20)

Verificadas con WebFetch: NIST 1.3.5.2 (fórmula t, interpretación), NIST 7.1.4 (fórmula z, σ estimada más ancha, interpretación a la larga), Introduction to Modern Statistics cap. 13 (EE, condición éxito–fracaso, estimación ± z*×EE, 1,96, advertencia sobre «con cierta probabilidad»), Pew 2016 (margen ±3 con n = 1 067, ventaja ≈ doble, subgrupos, efecto de diseño, errores ajenos al muestreo). **No verificado**: texto de OpenIntro Statistics (solo el índice de capítulos), fórmula del EE de la diferencia de proporciones y de la ventaja multinomial (derivadas; marcadas «verify» en las lecciones), afirmaciones sobre parada anticipada/comparaciones múltiples (mencionadas sin desarrollar y marcadas como no verificadas), nota sobre intervalos creíbles bayesianos.

## Puntuaciones (autoevaluadas)

| Lección | Exactitud | Prerrequisitos | Profundidad | Interacción | Feedback | Accesibilidad | Transferencia | Usabilidad |
|---|---|---|---|---|---|---|---|---|
| 1 variabilidad-datos | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 |
| 2 media-muestral | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| 3 construir-intervalo | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| 4 interpretar-intervalo | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| 5 encuestas-margen | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| 6 test-ab | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 1 |
| 7 planificar-supuestos (avanzada) | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |

Justificación de los 1: L1 profundidad (no se desarrollan formas de distribución más allá de la normal); L5, L6 y L7 exactitud (fórmula de la ventaja, del EE de la diferencia y los despejes de n derivados pero no contrastados con texto de OpenIntro/NIST); L6 usabilidad (lección densa para 30 minutos: probable que exceda el tiempo).

## Debilidades conocidas

- Lecciones 5 y 6 probablemente superan 30 minutos para quien aprende despacio.
- El valor crítico t del explorador de la lección 3 es una aproximación (z + (z³+z)/(4·gl)); se indica en los supuestos.
- Intervalo de Wald para proporciones: se avisa de sus límites, pero no se enseña una alternativa.
- Las cifras en los explorers integrados usan punto decimal, no coma (limitación del runtime); el simulador propio sí usa la coma.
- Se evitó la palabra «método» en el texto de las lecciones por una limitación del validador (véase PROGRESS.md).
