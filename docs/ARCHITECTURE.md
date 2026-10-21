# Architecture decision

## Target host

The tool is used from **Claude Code** (desktop app, Code tab; CLI 2.1.220 verified on this machine). The packaged instructions follow the open **Agent Skills** format, so other hosts that implement that format can load them. They have only been tested in Claude Code.

## Options compared

| Option | What it would provide | Fit |
|---|---|---|
| **Agent skill** | The authoring workflow, pedagogy references, content contract, templates, a runtime that renders courses, and helper scripts that validate and build | Course authoring is model work: research, writing, designing practice. Everything that must be deterministic (schema checks, bundling, hashing, Markdown export) fits in local scripts the agent runs. **Chosen.** |
| **MCP server** | Tools such as `validate_course` or `build_course`, and resources such as templates | Claude Code can already run local Node scripts, so an MCP server would only wrap the same scripts. It adds a process, SDK dependencies and configuration without enabling anything new. An MCP server does not supply a model either: the host model still writes the content. |
| **Skill + MCP** | Interoperability with hosts that cannot run local scripts | Unjustified for the current requirement, and it would duplicate the teaching logic. Revisit only if a target host can load skills but cannot execute scripts, or if courses must be served to clients that only speak MCP. |

**Decision:** a single Agent Skill, `interactive-course-builder`, with no runtime dependencies beyond Node.js ≥ 18. No accounts, API keys, servers or deployment are needed. The generated course is a static folder that opens offline.

## Responsibility boundary

| Concern | Done by |
|---|---|
| Understanding the request, asking blocking questions, researching sources, designing outcomes and practice, writing lessons, reviewing accuracy | Host model, following `SKILL.md` and `references/` |
| Normalizing the learning request and listing unknowns | `scripts/lk.mjs check-request` (deterministic) |
| Validating course and lesson contracts, outcome coverage, ids, safety of HTML content | `scripts/lk.mjs validate` (deterministic) |
| Bundling into an offline site, hashing activities for learner-state compatibility, Markdown export, coverage report | `scripts/lk.mjs build`, `coverage` (deterministic) |
| Rendering, interaction, feedback, progress, export/import | `assets/runtime/` in the learner's browser (deterministic; no network) |
| Learner-state validation, format migration and concept review scheduling | `assets/runtime/lk-state.js` (pure functions shared by the browser and the Node tests) |
| Measuring whether changes improve courses | `evaluation/lk-eval.mjs` (maintainer tool outside the skill): automatic metrics, rubric reports, pilot summaries |

## Portable core vs host-specific parts

- **Portable:** `SKILL.md` frontmatter uses only `name`, `description` and `metadata`. `compatibility` is in the open specification, but some skill validators reject it, so the requirements are stated in the skill body and in `metadata.requires`. The runtime, schemas and scripts do not depend on any AI provider.
- **Claude Code–specific:** installation paths (`~/.claude/skills/` or `.claude/skills/`) and slash invocation (`/interactive-course-builder`). These are documented in the top-level `README.md`, not in the skill body.

## Sources checked (2026-10-20)

- Agent Skills specification: https://agentskills.io/specification. Checked: `name` (1–64 characters, lowercase letters, digits and hyphens; must match the directory name), `description` (max 1024 characters), optional `license`/`compatibility`/`metadata`, a body under 500 lines, and file references one level deep.
- Claude Code skills: https://code.claude.com/docs/en/skills. Checked: personal `~/.claude/skills/<name>/SKILL.md`; project `.claude/skills/<name>/SKILL.md`; live reload of skill directories; removal by deleting the directory.
- MCP architecture: https://modelcontextprotocol.io/docs/learn/architecture. Consulted for the comparison only; no MCP server is implemented. Relevant to the decision: servers expose tools, resources and prompts over stdio or Streamable HTTP. The *sampling* primitive (a server asking the client's model for completions) is deprecated as of protocol version `2026-07-28`, so an MCP server would need its own model provider to write content. That reinforces keeping authoring in the host model.
