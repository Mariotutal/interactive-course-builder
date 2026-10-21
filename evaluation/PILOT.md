# Learner pilot protocol

The rubric and the automatic metrics evaluate the **course artifact**. Only real learners show whether a course helps people learn. This protocol is for a small, honest pilot that needs no backend: learners study offline and send back their exported progress file.

## 1. Choose the course and the question

- Use a complete course, for example a benchmark course or a real one.
- Write down **one** question before starting, for example: "Do learners succeed on the transfer tasks after the core route?" or "Which lesson's checks fail most on first attempt?"
- Decide in advance what result would make you change the course.

## 2. Recruit and get consent

- Recruit 3–10 learners who match the course's intended learner. Record how they were recruited; friends and colleagues are a self-selected sample.
- Tell them, in writing:
  - what you will collect: the exported progress JSON;
  - what that file contains: answers, notes and free-text responses;
  - who will see it, and that they can delete anything before sending;
  - that participation is voluntary.
- The harness summary below includes **no free text**. If you read the files themselves, treat them as personal data. Do not publish raw exports.

## 3. Run

1. Give each learner the built `site/` folder, or a link to a private copy, plus the expected time (sessions × minutes).
2. Ask them to follow the core route and do the activities, checks and transfer tasks as they normally would. Ask them not to look up answers to checks before answering.
3. At the end, ask them to open **Progress and notes → Export progress (JSON)** and send the file. Optionally ask them to also export their notes.
4. Ask three short feedback questions:
   - what was hardest;
   - which activity helped most, and which did not;
   - whether they could now do the capstone task without the course open.

## 4. Summarise

```bash
node evaluation/lk-eval.mjs pilot <course-dir> exports/*.json --out evaluation/results/<course>/pilot.md
```

The summary validates every export: exports from another course or with a malformed structure are rejected and listed. It reports:

- per lesson: the share of learners who visited it, the number of auto-checked answers, the **first-attempt** correct rate, and the distribution of self-rated confidence;
- per outcome: the first-attempt correct rate on the auto-checked questions that assess it;
- the share of learners who wrote a transfer or capstone response (at least 20 characters). This counts responses and says nothing about their quality;
- per concept, when the course has a knowledge architecture: retrieval counts and success rate.

## 5. Score what counts can't

- Score a sample of transfer and capstone responses with the lesson rubrics and the capstone rubric. If possible, use a reviewer who did not write the course, and record who scored.
- Compare confidence with first-attempt performance. A large gap in either direction is worth a look.

## 6. Report honestly

Include:

- N, recruitment, dates and course version;
- the pre-registered question;
- the results;
- the changes you made because of them.

Do not generalise from a handful of learners. "Three of four learners failed the first check in lesson 2 on first attempt" is a finding. "The course works" is not.
