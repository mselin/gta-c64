# Notes for Claude

Working agreements from the owner, for every Claude Code session in this repository.

- **Always merge when green.** Make every change on a branch and open a pull request. As soon as all of its
  checks pass, merge it (a merge commit) without asking first. Never merge a pull request with a failing or
  unfinished check, never push to `main`, and never get round a required check: if something fails, fix it on
  the branch and wait again, or say what is wrong.
- Features and implementation work are tracked as issues here (the Feature and Implementation forms), and a
  pull request says which issue it closes.
- A change to the game's rules or look updates `specs/design.md` in the same pull request: the Commodore 64
  version, in mselin/Sleazeburg64, follows that document.
