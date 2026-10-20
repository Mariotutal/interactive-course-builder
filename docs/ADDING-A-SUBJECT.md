# Adding a new subject without changing the core

The core (`skills/interactive-course-builder/`) is subject-independent. A new subject is only new **data**:

1. **Write a learning request** (`request.json`) with the topic, goals, learner profile, language, time and practice resources. Put personal details here and nowhere else. Run `lk.mjs check-request`.
2. **Create the course folder** with `lk.mjs init request.json my-course`, or by copying `assets/templates/starter-course/` as a format reference.
3. **Define the outcomes and modules** in `course.json`: observable outcomes, a prerequisite order, routes, a glossary, an optional diagnostic and a capstone.
4. **Write the lessons** in `lessons/<id>.json` using the block types. Pick interaction patterns by the kind of knowledge (`references/activities.md`). Use `exemptions` with a reason when a lesson function does not fit the subject.
5. **Add a custom activity only if no built-in pattern fits.** Put a file in `my-course/widgets/` that calls `LK.registerWidget(...)`. The build copies it into the site, and the validator checks that it is registered. The core runtime is not edited.
6. **Change the UI language** by setting `language` in `course.json`. UI strings ship in English and Spanish. For another language, override the strings you need in `course.ui`; untranslated strings fall back to English.
7. **Validate and build**, review with the rubric, and check the result in a browser.

The three examples in `examples/` were produced exactly this way, each in a fresh context and with the core left unchanged.

## When the core *should* change

Change the core only when a need recurs across subjects and cannot be met with data or a custom widget, such as a new block type or a new general interaction pattern. When you do:

- add a test to `tests/run-tests.mjs`;
- document the change in `references/`;
- keep `format: 1` backward compatible, or bump the format and handle migration in `lk-app.js`'s `load()`.
