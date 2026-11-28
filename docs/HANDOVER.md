# Handover

The working state for sessions on mselin/gta-c64. Read `docs/HANDOVER-PROTOCOL.md` for how to keep it. Where this
file and a conversation summary disagree, this file wins.

**What never goes in a handover file** (`docs/HANDOVER.md`, `docs/handover/*.md`): secrets, tokens and keys; the
owner's or anyone's personal details (email, real name beyond the `mselin` handle, addresses); session or chat
links; local paths of a session's machine or scratch space. They are committed and public. Name a secret by where
it lives (for example "the PRIVATE_TERMS Actions secret"), never by its value.

## Task

If you get flatlined by police or anyone whilst having $0 (or less than required) you should get busted and go to jail.

Then (sent mid-task): Also after heat 3 or more police should ram you very aggresively if they don't


## Plan

1. #118, unpaid bill: wasted with less than `PENALTY.bill` ($500) goes as a bust (`down` / `respawn` in `js/player.js`). Check: `tests/unit/unpaid.test.js`, design "Wasted or busted". **Done** (branch `unpaid-bill`).
2. One PR closing #118, merged when green. Check: merged, all checks passed.
3. Police ramming from heat 3: new issue, then `copAI` in `js/cars.js`, tests, design, own PR. Check: merged.


## Established

- **#118, read as:** "go to jail" = the bust rules. Short of $500: the police station and the fifth; with $0, the jail ending (BUSTED AND BROKE, `js/endings.js`). `lastDown()` stays 'dead' so the banner and Discord presence say flatlined.
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
- **The private-details guard is off in this repository.** `check_repo.py` fails a build on any term in the
  `PRIVATE_TERMS` Actions secret, but the secret is not set here: CI says "PRIVATE_TERMS not set" on main and on
  PRs (the Repository checks job of #113, and main after it). Only the owner can add it, under the repository's
  Settings, Secrets and variables, Actions. Until then, check by hand before committing anything about people.
  Checked 2026-11-27: the owner's email and name appear nowhere in the repository or these files.
- **The C64 roadmap** (mselin/Sleazeburg64 `docs/ROADMAP.md`) has notes on every browser change above, the latest in Sleazeburg64#102 (#110). That repository's ruleset wants branches up to date with main: merge main in rather than rebase.

## Changes

- gta-c64, branch `unpaid-bill` (#118): `PENALTY` in `js/config.js`; `unpaid` in `js/player.js`; `tests/unit/unpaid.test.js`; the knife test in `tests/unit/melee.test.js` now has the bill to hand; design "Wasted or busted".


## Verification

- `npm run -s lint`: clean. `npm run -s test:unit`: 310 pass.
- `npm run -s test:e2e`: 62 pass, 4 skip. CI runs all on the PR.


## Dead ends

- `gh issue create` and `gh pr create` use GraphQL, which these sessions cannot reach. Use REST: `gh api repos/mselin/gta-c64/issues` and `gh api repos/mselin/gta-c64/pulls`.
- A merge refused with "Required status check … is expected" can also mean the branch is behind main under a strict ruleset (Sleazeburg64), not that a check is pending. Merge main in.
- WebKit e2e flakes happen when a check races a frame or reads one moment of audio. Wait on state with margin, not on a single frame (#95).

## Next

Step 3: read `copAI` in `js/cars.js` (and its chase targeting), open the ramming issue, make chasing cars at heat 3+ drive into the player rather than alongside.


## Subagent files

None.
