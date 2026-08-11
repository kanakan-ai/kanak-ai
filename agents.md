# Kanak AI — implementation agent instructions

This folder is the **app**. Product/design truth is in the workspace folder **kanak-ai-specs**.

## Always read first
1. kanak-ai-specs/STEERING.md
2. kanak-ai-specs/agent-workflow.md
3. kanak-ai-specs/prompts/system.md
4. kanak-ai-specs/mvp-scope-and-milestones.md → **M1 only** until human says otherwise
5. kanak-ai-specs/design/TECH_STACK.md
6. kanak-ai-specs/design/api/openapi.yaml
7. kanak-ai-specs/design/data/schema.sql

## Rules
- Write all code in **this** repo (`kanak-ai`), not in kanak-ai-specs
- One task at a time; human approves before the next task
- Task done = integration tests pass + CX human verification script
- No React Native until M4; passwordless only; upload requires documentType

## Start
Propose M1 task list only; do not code until approved.