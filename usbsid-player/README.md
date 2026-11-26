# USBSID-Player (WebAssembly build)

The SID tune player used by the Sleazeburg 64 radio. It is the same player the
High Voltage SID Collection website uses: a cycle-exact Commodore 64 emulator
with the reSIDfp SID engine.

- Project and source code: https://github.com/LouDnl/USBSID-Player
- Author: LouDnl
- Licence: GNU General Public License, version 2 or later. See `LICENSE`.
  Libraries bundled into the build (such as reSIDfp) keep their own licences;
  see the project page.

The four files here (`usbsid.esm.js`, `usbsid.wasm`, `usplayer-web.js`,
`usplayer-audio.js`) are unmodified copies of the build served by
https://www.hvsc.c64.org/ under `assets/usbsid-player/`, fetched on
2026-11-19. To update, rebuild from the project source (see "Build the
WebAssembly player" in its README) or copy a newer build, keeping the four
files from the same build together.

SHA-256 of the four files, checked by `tests/unit/vendor.test.js` and matching
the copies on www.hvsc.c64.org on 2026-11-26:

| File | SHA-256 |
|---|---|
| `usbsid.esm.js` | `13f02931c5961f4dab1c0595d7bf484ddd45f59ee6a059db078b667f6b4c8ea6` |
| `usbsid.wasm` | `bba4c202d2f657e59b27f52ca233541932569b98a1981694ddf04a2bdf08eb14` |
| `usplayer-audio.js` | `1bcc69665ccfbf9c71114e6c45aa21473b093e923f42403f91167186848f644d` |
| `usplayer-web.js` | `fd850781612166d16303bc356f9de7e14876e8c6912fa8cd7d3bb5ec368dbefc` |

A new build changes these: update the table with it.

The game talks to the player only through `../sidplayer.js`.
