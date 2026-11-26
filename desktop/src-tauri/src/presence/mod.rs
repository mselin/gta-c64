// SPDX-License-Identifier: GPL-2.0-or-later
//! Discord Rich Presence for the app: the game's page reports a few enumerated values through one command,
//! and a thread of its own keeps Discord in step, so the page never waits on Discord.

pub mod discord;
pub mod schema;
pub mod session;

use schema::{GameState, Schema};
use session::{Session, Status};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

/// The Discord application the presence appears under. It is public: every copy uses the same one, and the
/// presence bridge uses it too.
pub const APP_ID: &str = "1573107526919266335";

/// The most the page may send in one state, as JSON. A real state is well under a hundred bytes.
const MAX_STATE: usize = 1024;

pub struct Service {
    session: Arc<Mutex<Session>>,
    /// The page's latest word, for the presence thread to take: a state, or None for stop. The page never
    /// takes the session's lock, which that thread holds while it talks to Discord (seconds, if whatever
    /// serves Discord's endpoint is slow); it leaves its state here and goes.
    mailbox: Arc<Mutex<Option<Option<GameState>>>>,
    /// What the presence thread last saw, for the page.
    status: Arc<Mutex<Status>>,
    /// The schema the page's states are checked against: a copy of the session's, so checking needs no lock.
    schema: Schema,
    poke: Mutex<Sender<()>>,
}

impl Service {
    pub fn start() -> Service {
        let started = Instant::now();
        let mut seed = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(1) as usize;
        Service::run(Session::new(
            Schema::load(),
            APP_ID.into(),
            Box::new(move || started.elapsed().as_millis() as u64),
            Box::new(|| {
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0)
            }),
            Box::new(move || {
                // Which of a mode's lines to show: any will do, it need not be unpredictable.
                seed = seed
                    .wrapping_mul(6364136223846793005)
                    .wrapping_add(1442695040888963407);
                seed >> 33
            }),
            Box::new(discord::dial),
            Box::new(|line| eprintln!("presence: {line}")),
        ))
    }

    /// Runs a session on a thread of its own: a tick a second, and one at once whenever the page says something.
    fn run(session: Session) -> Service {
        let status = Arc::new(Mutex::new(session.status()));
        let session = Arc::new(Mutex::new(session));
        let mailbox: Arc<Mutex<Option<Option<GameState>>>> = Arc::new(Mutex::new(None));
        let (poke, wait) = channel::<()>();
        let (worker, letters, shown) = (session.clone(), mailbox.clone(), status.clone());
        std::thread::Builder::new()
            .name("presence".into())
            .spawn(move || loop {
                let _ = wait.recv_timeout(Duration::from_secs(1));
                let letter = match letters.lock() {
                    Ok(mut m) => m.take(),
                    Err(_) => return,
                };
                let Ok(mut s) = worker.lock() else { return };
                match letter {
                    Some(None) => s.stop(),
                    Some(Some(st)) => s.update(st),
                    None => {}
                }
                s.tick();
                let now = s.status();
                drop(s);
                if let Ok(mut st) = shown.lock() {
                    *st = now;
                }
            })
            .expect("cannot start the presence thread");
        Service {
            session,
            mailbox,
            status,
            schema: Schema::load(),
            poke: Mutex::new(poke),
        }
    }

    /// A state from the page, or None when the game stops. Anything the schema does not list is refused.
    pub fn handle(&self, update: Option<serde_json::Value>) -> Result<Status, String> {
        let state = match update {
            None => None,
            Some(v) => {
                if v.to_string().len() > MAX_STATE {
                    return Err("state too large".into());
                }
                Some(
                    serde_json::from_value::<GameState>(v)
                        .map_err(|e| format!("not a valid state: {e}"))?,
                )
            }
        };
        // Checked here, so that a refused state is refused to the page at once.
        if let Some(st) = &state {
            self.schema.check(st)?;
        }
        *self
            .mailbox
            .lock()
            .map_err(|_| "presence is unavailable".to_string())? = Some(state);
        if let Ok(poke) = self.poke.lock() {
            let _ = poke.send(());
        }
        self.status
            .lock()
            .map(|s| s.clone())
            .map_err(|_| "presence is unavailable".to_string())
    }

    pub fn close(&self) {
        if let Ok(mut s) = self.session.lock() {
            s.close();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The presence thread can spend seconds dialling a Discord that is slow to answer. The page's calls do
    /// not wait for it: they leave their state and come back at once.
    #[test]
    fn the_page_never_waits_on_discord() {
        let started = Instant::now();
        let session = Session::new(
            Schema::load(),
            APP_ID.into(),
            Box::new(move || started.elapsed().as_millis() as u64),
            Box::new(|| 0),
            Box::new(|| 0),
            Box::new(|| {
                std::thread::sleep(Duration::from_secs(3));
                Err(std::io::Error::other("gave up"))
            }),
            Box::new(|_| {}),
        );
        let service = Service::run(session);
        let state = serde_json::json!({ "v": 1, "mode": "loading" });
        service.handle(Some(state.clone())).expect("a valid state");
        // Long enough for the presence thread to be in the middle of dialling.
        std::thread::sleep(Duration::from_millis(300));
        let asked = Instant::now();
        service.handle(Some(state)).expect("a valid state");
        service.handle(None).expect("stop");
        assert!(
            asked.elapsed() < Duration::from_millis(500),
            "the page waited {:?}",
            asked.elapsed()
        );
        assert!(
            service
                .handle(Some(serde_json::json!({ "v": 1, "mode": "no such mode" })))
                .is_err(),
            "a state the schema does not list is still refused at once"
        );
    }
}
