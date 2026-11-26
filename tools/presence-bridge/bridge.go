// SPDX-License-Identifier: GPL-2.0-or-later

package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const (
	minUpdateGap     = 15 * time.Second // Discord's own limit on activity updates
	heartbeatTimeout = 30 * time.Second // no word from the game for this long: it has gone
	pausedTimeout    = 5 * time.Minute  // paused for this long: stop showing
	pingEvery        = 10 * time.Second // how often to check Discord is still there
	claimPriority    = 30               // see claim()
	redialEvery      = 5 * time.Second  // while Discord cannot be reached
	// Every send to Discord counts against these, clears included, so that showing and clearing in turn
	// cannot send as fast as anyone asks.
	sendBurst  = 5
	sendWindow = 20 * time.Second
	// Session starts and ends are logged up to logBurst in any logWindow; past that only counted.
	logBurst  = 6
	logWindow = 30 * time.Second
)

// Bridge holds one play session and keeps Discord in step with it.
type Bridge struct {
	schema *Schema
	appID  string
	now    func() time.Time
	random func() int
	dial   func() (io.ReadWriteCloser, error)
	logf   func(format string, args ...any)
	// claimDir, if it exists, is where presence programs on one machine tell each other who should show.
	claimDir string

	// mu guards everything below and is only ever held briefly. io is held while talking to Discord, which can
	// take seconds (ipcTimeout) if whatever serves its endpoint is slow, and never together with mu: so a slow or
	// silent Discord holds up no HTTP request and no status read. See sync.
	io          sync.Mutex
	mu          sync.Mutex
	active      bool      // a session is running
	hidden      bool      // paused for too long; shows again when play resumes
	start       time.Time // when the session started: the elapsed timer on the profile
	lastBeat    time.Time
	state       State
	pick        int // which variant line, chosen when the mode is entered
	pausedSince time.Time

	conn       *discordConn
	sent       *Activity // what Discord is showing, nil for nothing
	lastSend   time.Time
	lastPing   time.Time
	downLogged bool
	lastDial   time.Time
	nonce      int
	claimUntil time.Time   // when the claim file last written expires
	sends      []time.Time // when the recent sends to Discord went, for sendBurst
	logged     []time.Time // when the recent session starts and ends were logged, for logBurst
	unlogged   int         // starts and ends not logged since
}

// sessionLog logs a session starting or ending. Past logBurst in a logWindow it only counts them: a program
// that starts and ends sessions in a loop would otherwise fill the log.
func (b *Bridge) sessionLog(line string) {
	now := b.now()
	recent := b.logged[:0]
	for _, t := range b.logged {
		if now.Sub(t) < logWindow {
			recent = append(recent, t)
		}
	}
	b.logged = recent
	if len(b.logged) >= logBurst {
		b.unlogged++
		return
	}
	if b.unlogged > 0 {
		line = fmt.Sprintf("%s (and %d more starts and ends not logged)", line, b.unlogged)
	}
	b.logged, b.unlogged = append(b.logged, now), 0
	b.logf("%s", line)
}

// mayAlsoSend reports whether one more send to Discord fits in sendBurst per sendWindow.
func (b *Bridge) mayAlsoSend(now time.Time) bool {
	recent := b.sends[:0]
	for _, t := range b.sends {
		if now.Sub(t) < sendWindow {
			recent = append(recent, t)
		}
	}
	b.sends = recent
	return len(b.sends) < sendBurst
}

// Update takes a state from the game. It also counts as a heartbeat.
func (b *Bridge) Update(st State) {
	b.mu.Lock()
	now := b.now()
	resumed := b.hidden && st.Mode != "paused"
	if !b.active || resumed {
		b.active, b.hidden, b.start, b.pick = true, false, now, b.random()
		b.pausedSince = time.Time{}
		b.sessionLog("session started")
	}
	if st.Mode != b.state.Mode {
		b.pick = b.random()
		b.pausedSince = time.Time{}
		if st.Mode == "paused" {
			b.pausedSince = now
		}
	}
	b.state, b.lastBeat = st, now
	b.mu.Unlock()
	b.sync()
}

// Stop ends the session at once: the tab closed, the game quit or the setting was switched off.
func (b *Bridge) Stop() {
	b.mu.Lock()
	b.end("stopped by the game")
	b.mu.Unlock()
	b.sync()
}

// Tick runs once a second: it notices a game that has gone quiet, checks Discord is still there, and sends
// anything that was held back.
func (b *Bridge) Tick() {
	b.mu.Lock()
	now := b.now()
	if b.active && now.Sub(b.lastBeat) > heartbeatTimeout {
		b.end("no heartbeat from the game")
	}
	if b.active && !b.hidden && !b.pausedSince.IsZero() && now.Sub(b.pausedSince) > pausedTimeout {
		b.hidden = true
		b.logf("paused for a long time: hiding")
	}
	b.mu.Unlock()
	if !b.io.TryLock() {
		return // a request is talking to Discord: the next tick does this
	}
	defer b.io.Unlock()
	b.mu.Lock()
	c := b.conn
	ping := c != nil && now.Sub(b.lastPing) >= pingEvery
	if ping {
		b.lastPing = now
	}
	b.mu.Unlock()
	if ping {
		err := c.ping()
		b.mu.Lock()
		if err != nil && b.conn == c {
			b.lost(err)
		}
		b.mu.Unlock()
	}
	b.syncHeld()
}

// Close clears the presence and releases everything. Called on exit: it waits for any exchange with Discord
// that is under way, so that the clear is the last thing sent.
func (b *Bridge) Close() {
	b.mu.Lock()
	b.end("bridge exiting")
	b.mu.Unlock()
	b.io.Lock()
	defer b.io.Unlock()
	b.syncHeld()
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.conn != nil {
		b.conn.rw.Close()
		b.conn = nil
	}
}

// Status is what GET /v1/status and every other reply report.
func (b *Bridge) Status() map[string]any {
	b.mu.Lock()
	defer b.mu.Unlock()
	return map[string]any{
		"ok":                true,
		"name":              "sleazeburg-presence",
		"version":           version,
		"schema":            b.schema.V,
		"app_id_configured": b.appID != "",
		"discord_connected": b.conn != nil,
		"showing":           b.sent != nil,
	}
}

func (b *Bridge) end(why string) {
	if !b.active {
		return
	}
	b.active, b.hidden, b.state = false, false, State{}
	b.sessionLog("session ended: " + why)
}

func (b *Bridge) lost(err error) {
	b.conn.rw.Close()
	b.conn = nil
	b.sent = nil // whatever Discord was showing went with the connection
	b.lastSend = time.Time{}
	if !b.downLogged {
		b.downLogged = true
		b.logf("lost Discord (%v); will keep trying", err)
	}
}

// sync brings Discord into line with the session, within the rate limit. If another call is already talking
// to Discord it returns at once: that one, or the next tick a second later, sends whatever is wanted by then.
func (b *Bridge) sync() {
	if !b.io.TryLock() {
		return
	}
	defer b.io.Unlock()
	b.syncHeld()
}

// syncHeld is sync with b.io held. It decides with b.mu held, talks to Discord without it, and records what
// happened with it held again.
func (b *Bridge) syncHeld() {
	b.mu.Lock()
	dial := b.needDial()
	b.mu.Unlock()
	if dial {
		c, err := b.connect()
		b.mu.Lock()
		b.connected(c, err)
		b.mu.Unlock()
		if err != nil {
			return
		}
	}
	b.mu.Lock()
	c, want, start, nonce, now, ok := b.nextSend()
	b.mu.Unlock()
	if !ok {
		return
	}
	err := c.setActivity(want, start, nonce)
	b.mu.Lock()
	defer b.mu.Unlock()
	if err != nil {
		if b.conn == c {
			b.lost(err)
		}
		return
	}
	if want == nil {
		b.logf("cleared")
	} else {
		b.logf("showing: %s | %s", want.Details, want.State)
	}
	b.sent, b.lastSend = want, now
}

// wanted is what Discord should show now, nil for nothing; and whether that differs from what it shows and is
// due to be sent. Changes of text wait their turn (minUpdateGap) and the latest one wins; clearing, and showing
// after a clear, do not wait. With b.mu held.
func (b *Bridge) wanted(now time.Time) (*Activity, bool) {
	var want *Activity
	if b.active && !b.hidden && b.appID != "" {
		a := b.schema.Render(b.state, b.pick)
		want = &a
	}
	b.claim(want != nil)
	if (want == nil) == (b.sent == nil) && (want == nil || *want == *b.sent) {
		return want, false
	}
	if want != nil && b.sent != nil && now.Sub(b.lastSend) < minUpdateGap {
		return want, false
	}
	return want, true
}

// needDial reports whether Discord should be dialled now: something is to be shown, there is no connection and
// the last try was redialEvery ago. With b.mu held.
func (b *Bridge) needDial() bool {
	now := b.now()
	want, due := b.wanted(now)
	if !due || b.conn != nil {
		return false
	}
	if want == nil {
		b.sent = nil
		return false
	}
	if now.Sub(b.lastDial) < redialEvery {
		return false
	}
	b.lastDial = now
	return true
}

// connect dials Discord and introduces the bridge. Without b.mu: it can take up to ipcTimeout.
func (b *Bridge) connect() (*discordConn, error) {
	rw, err := b.dial()
	if err != nil {
		return nil, err
	}
	c := &discordConn{rw}
	if err := c.handshake(b.appID); err != nil {
		rw.Close()
		return nil, err
	}
	return c, nil
}

// connected records how a dial went. With b.mu held.
func (b *Bridge) connected(c *discordConn, err error) {
	if err != nil {
		if !b.downLogged {
			b.downLogged = true
			b.logf("cannot reach Discord (%v); will keep trying", err)
		}
		return
	}
	b.conn, b.lastPing = c, b.now()
	if b.downLogged {
		b.logf("Discord is back")
	}
	b.downLogged = false
}

// nextSend decides what to send, if anything, and takes its place in the rate limit. With b.mu held.
func (b *Bridge) nextSend() (c *discordConn, want *Activity, start time.Time, nonce string, now time.Time, ok bool) {
	now = b.now()
	want, due := b.wanted(now)
	if !due || b.conn == nil {
		if want == nil && b.conn == nil {
			b.sent = nil
		}
		return
	}
	if !b.mayAlsoSend(now) {
		return // held back: a later tick sends whatever is wanted by then
	}
	b.sends = append(b.sends, now)
	b.nonce++
	return b.conn, want, b.start, fmt.Sprint(b.nonce), now, true
}

// claim cooperates with other presence programs on the same machine. Each one that wants to show writes
// <name>.claim with a priority and an expiry; the highest unexpired priority shows and the others hide.
// It only happens where the shared directory already exists, and the file's contents are fixed.
func (b *Bridge) claim(showing bool) {
	if b.claimDir == "" {
		return
	}
	file := filepath.Join(b.claimDir, "sleazeburg-64.claim")
	if !showing {
		if !b.claimUntil.IsZero() {
			os.Remove(file)
			b.claimUntil = time.Time{}
		}
		return
	}
	now := b.now()
	if b.claimUntil.Sub(now) > 30*time.Second {
		return // still fresh: no need to touch the disk every second
	}
	// Only in a directory of this user's that no one else can write in, so that the file cannot have been
	// swapped for a link to somewhere else.
	if !privateDir(b.claimDir) {
		return
	}
	b.claimUntil = now.Add(time.Minute)
	body, _ := json.Marshal(map[string]int64{"priority": claimPriority, "expires": b.claimUntil.Unix()})
	// Written beside it and renamed into place: a rename replaces whatever is at the name, a link included,
	// rather than writing through it.
	tmp, err := os.CreateTemp(b.claimDir, ".sleazeburg-64.claim-*")
	if err != nil {
		return
	}
	_, werr := tmp.Write(body)
	cerr := tmp.Close()
	if werr != nil || cerr != nil || os.Rename(tmp.Name(), file) != nil {
		os.Remove(tmp.Name())
	}
}
