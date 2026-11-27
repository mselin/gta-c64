# Handover

The working state for sessions on mselin/gta-c64. Read `docs/HANDOVER-PROTOCOL.md` for how to keep it. Where this
file and a conversation summary disagree, this file wins.

## Task

Bootstrap only: create the handover docs in gta-c64 from the design doc, roadmap and git log. No code changes. Open a PR.

## Plan

1. Create `docs/HANDOVER-PROTOCOL.md` (sections 2-5 of the short-context skill, verbatim). Check: the file exists. **Done.**
2. Create this file from `specs/design.md`, mselin/Sleazeburg64 `docs/ROADMAP.md` and `git log`. Check: every section filled, under 150 lines. **Done.**
3. Open a pull request with only these two files, and merge it when green (`.claude/CLAUDE.md`). Check: merged, all checks passed. **Done when #113 merges** (it merges itself on green; if this line is still here after that, the task is finished).

## Established

- **The project.** "Sleazeburg 64", a top-down C64-styled crime satire.
  - The browser game is this repository (live at https://mselin.github.io/gta-c64/).
  - The desktop app (`desktop/`, Tauri 2) runs the same code.
  - The Commodore 64 version is in mselin/Sleazeburg64 and follows `specs/design.md` (872 lines). Its intro says it is the one place for the rules and the look.
- **Working agreements** (`.claude/CLAUDE.md`):
  - Every change goes on a branch with a PR, which is merged (merge commit) once all checks pass. Never push to main.
  - Features are tracked as issues, and a PR says which issue it closes.
  - A change to the rules or look updates `specs/design.md` in the same PR.
  - No code or spec changes in mselin/Sleazeburg64. Only issues are allowed there, plus short notes in its `docs/ROADMAP.md` when the owner asks ("add to roadmap"). The notes link to the design and the PR, and say nothing about how the C64 should do it.
- **Code layout.**
  - The game: ES modules in `js/*.js`, with the state in `G` and `P` (`js/state.js`) and tunables in `js/config.js`.
  - Tests: `tests/unit` (node:test) and `tests/e2e` (Playwright: `helpers.cjs` `openGame`, `game.read` / `until` / `press`).
  - The presence bridge: `tools/presence-bridge` (Go).
  - The desktop app's Rust: `desktop/src-tauri`.
- **Checks** (`.github/workflows/ci.yml`; "All checks passed" gates merges and the Pages deploy):
  - site (HTML);
  - repo (`python3 .github/scripts/check_repo.py`);
  - game: `npm run -s lint`, `npm run -s test:unit` (306 tests), `npm run -s test:e2e` (62 pass and 4 skip locally);
  - browser engines (Firefox, WebKit);
  - bridge on Linux, Windows and macOS (`go vet`, `go test`, race detector on Linux), with reproducible builds;
  - Homebrew;
  - desktop on Windows, Linux and macOS (`cargo fmt --check`, `cargo clippy --locked --all-targets -D warnings`, `cargo test --locked`; `node desktop/stage.mjs` stages `desktop/dist` first).
- **The web build's CSP** is a meta tag in `index.html`. `desktop/stage.mjs` strips it from the app's copy, allowing CRLF line ends on Windows (#93). e2e waits poll from Node, because `waitForFunction` with a string is `eval` and the CSP forbids it.
- **Recent features**, each with its section in the design doc:
  - **Difficulty:** CLASSIC (the default) or MODERN, changed with D on the title (#85). Modern-only: cursed driver assistance, alarms and GAGGLE cameras. Riders are skaters on classic and scooters on modern (#89, #91).
  - **Police:**
    - helicopter at heat 5 (#83, #95);
    - weapons taken when busted, or when wasted near the police (#76);
    - sidewalk driving seen by the police is a crime (#107);
    - separate arrest counts (#95).
  - **Cars and people:**
    - cars run people over by their whole body, and slow cars push people aside (#110);
    - gentle settle onto axes, and 64 car directions (#87).
  - **Title:**
    - the supercar picture (#105);
    - a 5 s pause on the loaded boot picture (#78);
    - the paint-shop arrow (#80).
- **Review and audit of 2026-11-26.** Fixed in #93, #95, #97, #100 and #101; tracking issue #98 is closed. Accepted risks:
  - the shared mselin.github.io origin;
  - other local users can reach the bridge on 127.0.0.1;
  - the page can be framed;
  - `blob:` in the desktop CSP, which the SID player's AudioWorklet and worker need.
- **The C64 roadmap** (mselin/Sleazeburg64 `docs/ROADMAP.md`) has notes on every browser change above, the latest in Sleazeburg64#102 (#110). That repository's ruleset wants branches up to date with main: merge main in rather than rebase.

## Changes

- gta-c64, branch `handover-docs`, PR #113 (closes #112): adds `docs/HANDOVER-PROTOCOL.md` and `docs/HANDOVER.md`. No code changes.

## Verification

- `python3 .github/scripts/check_repo.py` with these files staged: OK, 178 tracked files checked.
- Not run: the code tests, since no code changed. CI runs them on the PR.

## Dead ends

- `gh issue create` and `gh pr create` use GraphQL, which these sessions cannot reach. Use REST: `gh api repos/mselin/gta-c64/issues` and `gh api repos/mselin/gta-c64/pulls`.
- A merge refused with "Required status check … is expected" can also mean the branch is behind main under a strict ruleset (Sleazeburg64), not that a check is pending. Merge main in.
- WebKit e2e flakes happen when a check races a frame or reads one moment of audio. Wait on state with margin, not on a single frame (#95).

## Next

Answer open issue #108, which the C64 sessions raised: the design doesn't give the officers' walking pace (`PACE.cop = 47 * PERSON` in `js/config.js`) or the on-foot arrest (`d < 7 * PERSON` in `js/peds.js` `updPeds`). Add both to "Heat and the police" in `specs/design.md`, in a PR that closes #108. Then #111: patrol-car share and traffic mix (`spawnRoad` in `js/spawner.js`).

Other open issues: #3–#8 are repository settings, releases, desktop signing, the Discord page and SECURITY.md (owner decisions).

## Subagent files

None.
