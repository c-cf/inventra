"""In-memory throttle for logins.

Two budgets apply to every attempt, both counted *before* the password is
checked so parallel requests cannot all slip through:

* per (client address, username): ``max_attempts`` per window, then locked;
* per client address across all usernames: ``max_attempts_per_client``, so one
  client cannot churn through usernames (for example to push other entries out).

A successful login clears its own key and refunds its attempt to the client
budget. Entries expire with their window. The table is capped; only unlocked
entries are ever evicted, and if every tracked entry is locked new keys are
refused (fail closed) rather than letting an attacker evict a lock.

Keying by client means an attacker cannot lock a real user out from another
machine. Behind a reverse proxy the client address is the proxy's unless
uvicorn is told to trust it (``--forwarded-allow-ips``); only trust the proxy's
own address there, or clients could spoof X-Forwarded-For.

State lives in the process, which suits this single-instance app; a
multi-instance deployment would need a shared store.
"""

import math
import threading
import time
from dataclasses import dataclass

DEFAULT_MAX_ENTRIES = 10_000
DEFAULT_MAX_ATTEMPTS_PER_CLIENT = 20
# Username slot for the per-client budget; contains a NUL so no real username can equal it.
_ANY_USER = "\0any"
_SWEEP_INTERVAL_SECONDS = 1.0

Key = tuple[str, str]


def _now() -> float:
    return time.monotonic()


@dataclass
class _Entry:
    window_start: float
    attempts: int = 0
    locked_until: float = 0.0

    def locked(self, now: float) -> bool:
        return self.locked_until > now


class LoginThrottle:
    def __init__(
        self,
        *,
        max_attempts: int,
        lockout_seconds: int,
        max_entries: int = DEFAULT_MAX_ENTRIES,
        max_attempts_per_client: int = DEFAULT_MAX_ATTEMPTS_PER_CLIENT,
    ) -> None:
        self._max_attempts = max_attempts
        self._lockout_seconds = lockout_seconds
        self._max_entries = max_entries
        self._max_attempts_per_client = max_attempts_per_client
        self._entries: dict[Key, _Entry] = {}
        self._last_sweep = float("-inf")
        self._lock = threading.Lock()

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)

    def retry_after(self, key: Key) -> int:
        """Seconds until this key may try again; 0 when it is not locked."""
        with self._lock:
            return self._wait(key, _now())

    def begin(self, key: Key) -> int:
        """Start an attempt: 0 if it may go ahead (and is counted), else seconds to wait."""
        client_key = (key[0], _ANY_USER)
        with self._lock:
            now = _now()
            wait = max(self._wait(key, now), self._wait(client_key, now))
            if wait:
                return wait
            self._sweep(now)
            if not self._make_room([key, client_key], now):
                return self._lockout_seconds  # table full of locks: fail closed
            self._count(key, self._max_attempts, now)
            self._count(client_key, self._max_attempts_per_client, now)
            return 0

    def record_success(self, key: Key) -> None:
        with self._lock:
            self._entries.pop(key, None)
            client = self._entries.get((key[0], _ANY_USER))
            if client is not None and not client.locked(_now()) and client.attempts > 0:
                client.attempts -= 1

    def _wait(self, key: Key, now: float) -> int:
        entry = self._entries.get(key)
        if entry is None or not entry.locked(now):
            return 0
        return math.ceil(entry.locked_until - now)

    def _count(self, key: Key, limit: int, now: float) -> None:
        entry = self._entries.get(key)
        if entry is None or now - entry.window_start > self._lockout_seconds:
            entry = self._entries[key] = _Entry(window_start=now)
        entry.attempts += 1
        if entry.attempts >= limit:
            entry.attempts = 0
            entry.window_start = now
            entry.locked_until = now + self._lockout_seconds

    def _expired(self, entry: _Entry, now: float) -> bool:
        return not entry.locked(now) and now - entry.window_start > self._lockout_seconds

    def _sweep(self, now: float) -> None:
        # At most once a second, so a flood does not pay for a full scan on every attempt.
        if now - self._last_sweep < _SWEEP_INTERVAL_SECONDS:
            return
        self._last_sweep = now
        for key in [k for k, entry in self._entries.items() if self._expired(entry, now)]:
            del self._entries[key]

    def _make_room(self, keys: list[Key], now: float) -> bool:
        """Free slots for the keys not yet tracked, evicting only unlocked entries."""
        needed = sum(1 for key in keys if key not in self._entries)
        excess = len(self._entries) + needed - self._max_entries
        if excess <= 0:
            return True
        # Oldest first (dicts keep insertion order); never a lock, never a key in play.
        evictable = [
            k for k, entry in self._entries.items() if not entry.locked(now) and k not in keys
        ]
        if len(evictable) < excess:
            return False
        for key in evictable[:excess]:
            del self._entries[key]
        return True
