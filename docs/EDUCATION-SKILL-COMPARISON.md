# Comparison with education-oriented agent skills

_Research date: 2026-10-20. Popularity figures are public GitHub repository
stars and forks retrieved through the GitHub REST API on that date. They are a
signal of attention, not per-skill installs, learning outcomes or quality._

## Scope and method

This comparison prioritizes public, installable Agent Skills that address
curriculum design, tutoring or course delivery. It includes one official
marketplace integration and two smaller end-to-end references where they reveal
a capability that the more popular skills do not. It does **not** treat a large
repository's star count as the install count of one skill within it.

`interactive-course-builder` is evaluated from its [workflow](../skills/interactive-course-builder/SKILL.md), [deterministic validator and builder](../skills/interactive-course-builder/scripts/lk.mjs), [domain toolkit](../skills/interactive-course-builder/references/domain-toolkit.md), and browser runtime.

## The public comparators

| Project | Adoption signal | Relevant capability | Comparison with interactive-course-builder |
| --- | --- | --- | --- |
| [GarethManning/education-agent-skills](https://github.com/GarethManning/education-agent-skills) | **884 stars / 122 forks** in the [public API record](https://api.github.com/repos/GarethManning/education-agent-skills). | A collection of 165 evidence-grounded education skills across 20 domains, including a [knowledge-architecture designer](https://github.com/GarethManning/education-agent-skills/blob/main/skills/curriculum-assessment/curriculum-knowledge-architecture-designer/SKILL.md) with explicit input/output schemas, prerequisite/hub/progression maps, assessment implications, and AI-tutoring implications. Its [backward-design planner](https://github.com/GarethManning/education-agent-skills/blob/main/skills/curriculum-assessment/backwards-design-unit-planner/SKILL.md) connects outcomes, evidence and sequencing. | Stronger on splitting pedagogical work into specialist skills, classifying different knowledge structures, and recording evidence. This repository is stronger on producing one validated, offline course artifact with a learner runtime and reusable interactive visuals. |
| [alirezarezvani/claude-skills — `deep-learning-book`](https://github.com/alirezarezvani/claude-skills/blob/main/engineering/deep-learning-book/skills/deep-learning-book/SKILL.md) | The multi-skill repository had **28,449 stars / 3,978 forks** in its [public API record](https://api.github.com/repos/alirezarezvani/claude-skills); these numbers are not per-skill. | A bounded study companion for a 20-chapter source. It has a prerequisite-aware reading-path planner, source-to-current-practice delta, a glossary, a prerequisite map, rights/use boundary, and standard-library diagnostic tools for training failures and model arithmetic. | Stronger as a subject-specific companion with explicit scope and deterministic learner utilities. It is intentionally not a generic course generator or interactive course renderer. Its bounded-source approach is a useful model for courses based on a canonical text or specification. |
| [Coursera `learn-with-coursera`](https://github.com/coursera/skills/blob/main/skills/learn-with-coursera/SKILL.md) | The repository has only **1 star / 0 forks** in its [public API record](https://api.github.com/repos/coursera/skills), so stars are not its adoption signal. It is included in Anthropic's [official marketplace manifest](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json) and Coursera's [official Claude marketplace page](https://claude.com/marketplace/connectors/coursera). | A deliberately short diagnosis: topic, familiarity and preferred modality. It routes the learner to a course, project, video or live roleplay through provided catalog tools, then helps find a next path. | Stronger in product routing and low-friction learner intake. It depends on Coursera-hosted catalog and roleplay tools; it neither authors a course nor produces an offline artifact. Its small intake-to-delivery pipeline is worth borrowing. |
| [SugarMGP/study.skill](https://github.com/SugarMGP/study.skill/blob/main/SKILL.md) | **19 stars / 1 fork** in the [public API record](https://api.github.com/repos/SugarMGP/study.skill): a close functional reference, but low adoption. | An end-to-end anchoring → research → generation → learning → consolidation loop. It persists learner state, gates course completion on a learner-perspective review, starts a local viewer, and includes review scheduling and pace/depth adaptation. | Closest lifecycle comparison. It is stronger on durable learner state and review scheduling. This repository is stronger on formal course validation, offline export/import safety, output portability and interaction widgets. |
| [flyboat403/k12-skills](https://github.com/flyboat403/k12-skills) | **40 stars / 9 forks** in the [public API record](https://api.github.com/repos/flyboat403/k12-skills): niche but concrete. | A K–12 planning and differentiation package. Its lesson-planning and differentiation workflows create learner materials, observation records and tiered practice, grounded in supplied curriculum standards; output includes editable DOCX and an HTML preview. | Stronger for classroom-operational artifacts and planned differentiation. This repository is geared to self-paced courseware, so it lacks a teacher observation-record and tiered-work-sheet workflow. |

## Capability matrix

| Area | interactive-course-builder today | Best external reference | Meaningful gap or decision |
| --- | --- | --- | --- |
| Course artifact | Validated `course.json` and lesson files build into an offline web app plus Markdown; progress is local and exportable. | None of the direct comparators combine a schema, a validator, a static renderer and learner-state import/export. | Keep this as the core differentiator. It is more valuable than adding generic prose templates. |
| Curriculum architecture | Outcomes, routes, glossary and outcome-to-teaching/assessment coverage are required. | `education-agent-skills` distinguishes hierarchical, horizontal and dispositional knowledge, then changes sequencing and assessment logic accordingly. | Add an explicit knowledge-architecture pass before selecting modules and widgets. A single prerequisite chain is insufficient for social science and dispositional goals. |
| Visuals and interaction | Thirteen reusable widgets, including parameter explorer, timeline, source comparison, code trace, system flow and causal map. Domain profiles cover mathematics, systems, programming, social science, science and languages. | No direct competitor has an equivalent reusable offline widget runtime. Anthropic/Coursera-style products show the value of a tight task-to-feedback loop. | Focus on authentic domain sandboxes, not merely more widget names or color palettes. |
| Assessment | `full` lessons require prediction, guided and independent practice, checks and transfer; the validator checks coverage. | `education-agent-skills` is stronger on matching assessment mode to the knowledge type; `study.skill` is stronger on ongoing review state. | Add assessment-mode selection: auto-scored procedural check, rubric-supported reasoning, and teacher/peer observation should be represented separately. |
| Learner adaptation | Request captures background; diagnostic gives each lesson a fast-pass or full-study suggestion; authored routes are static. | `study.skill` persists pace/depth and review state; Coursera uses a small intake and modality choice; DeepTutor-style systems use concept prerequisites. | Persist a learner concept model and use it to recommend a route/review, while preserving learner choice. Do not infer mastery merely from visiting or clicking. |
| Evidence and scope | Lesson-local sources, image provenance, source requirement and HTML-safety validation. | `deep-learning-book` explicitly sets a source boundary, records the delta from source to current practice, and ships deterministic study tools. | For courses centered on a book, standard, API or certification blueprint, support a `canonicalSource` and a version-delta report. |
| Classroom differentiation | Generic learner background and accessibility fields. | `k12-skills` produces tiered exercises and teacher-facing observation artifacts. | Optional classroom mode could generate three practice tiers and observation/rubric exports; it should remain separate from the self-paced default. |

## What is already distinctive

This skill is unusually complete as a **course production system**. It does not
only advise an agent to write lessons: it gives the agent a content contract,
validates the course, packages an accessible local site, preserves learner
progress safely, exports Markdown, checks outcome coverage and provides
interactive visual primitives. The domain toolkit already prevents the same
visual form from being prescribed for mathematics, Kubernetes, programming and
social science.

The comparison does not support replacing that architecture with a giant prompt
or a collection of unvalidated templates. The stronger direction is to deepen
the planning and learner-model layers around the existing course format.

## Recommended roadmap

1. **Make knowledge architecture a first-class design step.**
   Add `knowledgeArchitecture` to `course.json`, with hierarchical prerequisite
   edges, horizontal lenses/hubs, and optional dispositional progression bands.
   Validate its internal references and require the author to select assessment
   approaches appropriate to each type. This directly addresses the difference
   between learning algebra, Kubernetes incident response and historical
   interpretation.

2. **Add a durable concept and review model.**
   Give concepts stable ids, record first introduction and later retrieval
   events, then produce a due-review queue from explicit intervals and learner
   performance. Retain the existing separation of completion, confidence and
   first-attempt correctness. Provide a migration/version policy for saved
   learner data before writing this state.

3. **Create four authentic, safe sandbox adapters.**

   | Domain | First adapter | Learning evidence |
   | --- | --- | --- |
   | Mathematics | Graph/geometry or statistical-model explorer with named parameters and test cases. | Learner predicts a change, adjusts an input, interprets the visible result and states a limit of the model. |
   | Kubernetes | Declarative manifest and reconciliation simulator using fixtures only. | Learner predicts scheduling/readiness changes, inspects controller state and explains a failed rollout. |
   | Programming | Constrained browser execution or trace runner with fixed inputs and resource limits. | Learner predicts output/state, debugs a failing test and explains the correction. |
   | Social science | Source/evidence pack with provenance, competing claims and uncertainty. | Learner weighs evidence, distinguishes mechanism from correlation and defends a qualified conclusion. |

   Build these through the existing course-local custom-widget seam. Each must
   declare assumptions, be keyboard usable, include text alternatives and never
   imply it runs a real cluster, compiler or experiment when it does not.

4. **Turn subject profiles into a composable visual system.**
   Preserve current profiles but add optional `layout`, `typeScale`,
   `diagramStyle`, `codeTheme`, `illustrationStyle` and token overrides. Validate
   contrast and `alt` text. This gives courses a different visual grammar rather
   than just rotating accent colors.

5. **Add a focused learner-intake stage.**
   Keep the full request contract available, but start with the three inputs
   that drive most decisions: target capability, current familiarity and
   preferred modality/practice load. Ask only the additional questions needed
   for selected labs. Store the answers and state which design choices they
   affected.

6. **Publish an evaluation harness before expanding further.**
   Create fixed benchmark requests for mathematics, Kubernetes, programming and
   social science. Automatically test schema/HTML safety/output integrity; then
   manually score factual accuracy, instructional sequencing, visual purpose,
   interaction relevance, accessibility, source quality and transfer coverage.
   Publish the rubric and results to distinguish a richer course from a longer
   one.

## Limits of this comparison

- GitHub stars and forks are repository-wide attention signals. They do not
  measure active installations, educational outcomes or per-skill use.
- Coursera is included because of verified official marketplace distribution,
  not because its GitHub star count is high.
- `study.skill` and `k12-skills` are valuable close references, but their low
  public adoption is stated explicitly.
- The comparison evaluates public instructions and source repositories. It does
  not claim independent learner-outcome studies for any listed project.
