"""In-memory throttle for failed logins, keyed by (client address, username).

Keying by client as well as username means an attacker cannot lock a real user
out from another machine. State lives in the process, which suits this
single-instance app; a multi-instance deployment would need a shared store.
"""

import math
import threading
import time
from dataclasses import dataclass


def _now() -> float:
    return time.monotonic()


@dataclass
class _Entry:
    failures: int = 0
    locked_until: float = 0.0


class LoginThrottle:
    def __init__(self, *, max_attempts: int, lockout_seconds: int) -> None:
        self._max_attempts = max_attempts
        self._lockout_seconds = lockout_seconds
        self._entries: dict[tuple[str, str], _Entry] = {}
        self._lock = threading.Lock()

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
            entry = self._entries.setdefault(key, _Entry())
            entry.failures += 1
            if entry.failures >= self._max_attempts:
                entry.failures = 0
                entry.locked_until = _now() + self._lockout_seconds

    def record_success(self, key: tuple[str, str]) -> None:
        with self._lock:
            self._entries.pop(key, None)
