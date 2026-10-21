# Domain toolkit: visuals, interactions and visual profiles

Choose a visual grammar from the learning task. A profile establishes a coherent starting point; it is not a requirement to use the same diagram, image or activity in every lesson.

| Domain | `theme.profile` | Useful visuals | Built-in interactions | Avoid |
|---|---|---|---|---|
| Mathematics and statistics | `mathematics` | Coordinate plots, number lines, geometric construction, distribution charts, worked symbolic steps | `parameter-explorer`, `stepper`, `code-trace` for an algorithm | Decorative equations or a graph without a quantity the learner can change |
| Systems, cloud and Kubernetes | `systems` | Architecture map, request/data flow, status transitions, real manifest excerpts | `system-flow`, `scenario`, `evidence-case`, `hotspot-diagram` | A generic cluster diagram that does not show what changes after an event |
| Programming | `programming` | Call stacks, memory/state tables, execution trace, small real code excerpts | `code-trace`, `stepper`, `cloze`, `evidence-case` | A fake terminal that claims to run code, or code that cannot be read on a small screen |
| Social science and humanities | `social-science` | Source artifacts, timelines, annotated maps, causal or argument map, comparison table | `causal-map`, `source-compare`, `timeline`, `evidence-case` | A causal map presented as proof when the relationship is contested |
| Natural science | `science` | Mechanism diagram, model with variables, experimental setup, evidence table | `parameter-explorer`, `system-flow`, `hotspot-diagram`, `evidence-case` | Simulated output presented as a measurement or prediction without assumptions |
| Language learning | `languages` | Contextual photograph, dialogue scene, pragmatic contrast, morphology table | `dialogue`, `cloze`, `classify`, `scenario` | Synthetic speech represented as a native-speaker recording |

## Visual selection

Give every visual one job: reveal structure, compare alternatives, trace change over time, show evidence, or let the learner manipulate a model. Prefer the smallest visual that makes that job easier than prose.

- Use an **original image or artifact** when its provenance is part of the lesson. Capture creator, date, collection, license and original page in the lesson source.
- Use a **generated image** only when it explains a relationship that a source image cannot show. Label it as generated or illustrative in its caption, state the simplification, and package it under the course `assets/` folder.
- Use a **diagram** for systems, mechanisms and relationships. Give it a text equivalent and use labels that survive on a 375 px screen.
- Use a **chart or model** only when the learner can read a concrete change. Parameter explorers should include a current point or another visible readout.

## A good interactive visual

An activity should form a small inquiry:

1. State a prediction or decision before the reveal.
2. Let the learner alter a meaningful input, choose evidence, move through a trace or inspect a relationship.
3. Show the consequence in a state, value, graph or explanation.
4. Explain the mechanism, uncertainty and boundary of the model.

Use a `custom widget` only when none of the built-ins can represent the mechanism. Keep it local to the course, keyboard operable and offline.
