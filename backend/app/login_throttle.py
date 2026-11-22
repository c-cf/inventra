"""In-memory throttle for failed logins, keyed by (client address, username).

Keying by client as well as username means an attacker cannot lock a real user
out from another machine. Behind a reverse proxy the client address is the
proxy's unless uvicorn is told to trust it (``--forwarded-allow-ips``); only
trust the proxy's own address there, or clients could spoof X-Forwarded-For.

State lives in the process, which suits this single-instance app; a
multi-instance deployment would need a shared store. Entries expire after the
lockout window and the number of tracked keys is capped, so unauthenticated
clients cannot grow it without bound.
"""

import math
import threading
import time
from dataclasses import dataclass

DEFAULT_MAX_ENTRIES = 10_000


def _now() -> float:
    return time.monotonic()


@dataclass
class _Entry:
    window_start: float
    failures: int = 0
    locked_until: float = 0.0


class LoginThrottle:
    def __init__(
        self,
        *,
        max_attempts: int,
        lockout_seconds: int,
        max_entries: int = DEFAULT_MAX_ENTRIES,
    ) -> None:
        self._max_attempts = max_attempts
        self._lockout_seconds = lockout_seconds
        self._max_entries = max_entries
        self._entries: dict[tuple[str, str], _Entry] = {}
        self._lock = threading.Lock()

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)

    def retry_after(self, key: tuple[str, str]) -> int:
        """Seconds until this key may try again; 0 when it is not locked."""
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return 0
            remaining = entry.locked_until - _now()
            return math.ceil(remaining) if remaining > 0 else 0

    def record_failure(self, key: tuple[str, str]) -> None:
        with self._lock:
            now = _now()
            self._forget_expired(now)
            entry = self._entries.get(key)
            if entry is None or now - entry.window_start > self._lockout_seconds:
                self._make_room()
                entry = self._entries[key] = _Entry(window_start=now)
            entry.failures += 1
            if entry.failures >= self._max_attempts:
                entry.failures = 0
                entry.window_start = now
                entry.locked_until = now + self._lockout_seconds

    def record_success(self, key: tuple[str, str]) -> None:
        with self._lock:
            self._entries.pop(key, None)

    def _forget_expired(self, now: float) -> None:
        expired = [
            key
            for key, entry in self._entries.items()
            if entry.locked_until <= now and now - entry.window_start > self._lockout_seconds
        ]
        for key in expired:
            del self._entries[key]

    def _make_room(self) -> None:
        # Evict the oldest windows first; the dict keeps insertion order.
        while len(self._entries) >= self._max_entries:
            del self._entries[next(iter(self._entries))]
