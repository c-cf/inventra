"""LoginThrottle on its own, with a fake clock."""

import pytest

from app import login_throttle
from app.login_throttle import LoginThrottle


@pytest.fixture()
def clock(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(login_throttle, "_now", lambda: now[0])
    return now


def test_failures_older_than_the_window_do_not_count(clock):
    throttle = LoginThrottle(max_attempts=3, lockout_seconds=60)
    key = ("10.0.0.1", "alice")
    throttle.record_failure(key)
    throttle.record_failure(key)

    clock[0] += 61
    throttle.record_failure(key)

    assert throttle.retry_after(key) == 0


def test_entries_are_forgotten_once_their_window_and_lock_have_passed(clock):
    throttle = LoginThrottle(max_attempts=3, lockout_seconds=60)
    throttle.record_failure(("10.0.0.1", "ghost-1"))

    clock[0] += 61
    throttle.record_failure(("10.0.0.1", "ghost-2"))

    assert len(throttle) == 1


def test_the_number_of_tracked_keys_is_capped(clock):
    throttle = LoginThrottle(max_attempts=3, lockout_seconds=60, max_entries=5)

    for n in range(50):
        throttle.record_failure(("10.0.0.1", f"ghost-{n}"))

    assert len(throttle) <= 5
