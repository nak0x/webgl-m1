# How to use these prompts with Claude Code

## File overview
```
CLAUDE.md                        ← persistent knowledge base, lives at project root
prompts/
  phase-1-scaffold.md            ← UI shell + Three.js preview
  phase-2-clipper-worker.md      ← geometry clipper + Web Worker
  phase-3-lod-export.md          ← LOD pipeline + export + manifest
  phase-4-polish.md              ← edge cases, performance, UX
```

## Setup

1. Create your project folder
2. Copy `CLAUDE.md` into the project root — Claude Code reads this automatically on every prompt
3. Run phases in order, one at a time

## How to invoke each phase

```bash
# From inside your project directory with Claude Code running:

claude < prompts/phase-1-scaffold.md

# Verify it works in the browser before continuing

claude < prompts/phase-2-clipper-worker.md

# Test the clipper with a synthetic GLB before continuing

claude < prompts/phase-3-lod-export.md

# Test with a real district GLB before continuing

claude < prompts/phase-4-polish.md
```

Or paste the contents of each prompt file directly into the Claude Code chat.

## Why this structure works

**CLAUDE.md** carries all constraints, schemas, and invariants so you never repeat them in a phase prompt. Each phase prompt is focused on deliverables only — the model reads CLAUDE.md first and already knows the worker protocol, file naming, manifest schema, and clipper rules.

**One phase per conversation** keeps context clean. The model doesn't carry stale assumptions from Phase 1 into Phase 3.

**Validation steps** at the end of Phase 2 and Phase 3 are intentional checkpoints. Don't skip them — a bug in the clipper discovered in Phase 4 costs 3× the tokens to fix.

## If something goes wrong mid-phase

Add a short correction at the top of your next message before sending the next phase:

```
The GLB parser in Phase 2 didn't handle multi-mesh GLBs correctly — 
it only read the first primitive. Fix this before proceeding.

[paste phase-3 content]
```

Don't start a new phase until the previous one is working.

## Token budget estimate

| Phase | Approx tokens in | Approx tokens out |
|-------|-----------------|-------------------|
| 1     | ~800            | ~3,000            |
| 2     | ~1,200          | ~5,000            |
| 3     | ~900            | ~3,500            |
| 4     | ~800            | ~2,500            |

CLAUDE.md adds ~600 tokens per phase (auto-read). Total estimated: ~20,000 tokens across all 4 phases for a complete, working implementation.
