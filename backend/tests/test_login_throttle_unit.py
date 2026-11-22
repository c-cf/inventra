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
    throttle.begin(key)
    throttle.begin(key)

    clock[0] += 61
    throttle.begin(key)

    assert throttle.retry_after(key) == 0


def test_entries_are_forgotten_once_their_window_and_lock_have_passed(clock):
    throttle = LoginThrottle(max_attempts=3, lockout_seconds=60)
    throttle.begin(("10.0.0.1", "ghost-1"))

    clock[0] += 61
    throttle.begin(("10.0.0.1", "ghost-2"))

    # ghost-1 is gone; what remains is ghost-2 and the client's budget entry.
    assert len(throttle) == 2


def test_the_number_of_tracked_keys_is_capped(clock):
    throttle = LoginThrottle(max_attempts=3, lockout_seconds=60, max_entries=5)

    for n in range(50):
        throttle.begin(("10.0.0.1", f"ghost-{n}"))

    assert len(throttle) <= 5


def test_attempts_still_in_flight_count_against_the_limit(clock):
    # Parallel logins all pass the lock check before bcrypt finishes for any of
    # them, so an attempt has to be counted when it starts, not when it fails.
    throttle = LoginThrottle(max_attempts=3, lockout_seconds=60)
    key = ("10.0.0.1", "alice")

    started = [throttle.begin(key) for _ in range(3)]

    assert started == [0, 0, 0]
    assert throttle.begin(key) > 0


def test_a_success_clears_the_attempts(clock):
    throttle = LoginThrottle(max_attempts=3, lockout_seconds=60)
    key = ("10.0.0.1", "alice")
    throttle.begin(key)
    throttle.begin(key)

    throttle.record_success(key)

    assert [throttle.begin(key) for _ in range(3)] == [0, 0, 0]


def test_a_client_cannot_free_a_locked_account_by_flooding_other_usernames(clock):
    throttle = LoginThrottle(
        max_attempts=3, lockout_seconds=60, max_entries=10, max_attempts_per_client=5
    )
    victim = ("203.0.113.7", "alice")
    for _ in range(3):
        throttle.begin(victim)

    for n in range(100):
        throttle.begin(("203.0.113.7", f"ghost-{n}"))

    assert throttle.retry_after(victim) > 0


def test_locked_entries_are_never_evicted_to_make_room(clock):
    throttle = LoginThrottle(max_attempts=3, lockout_seconds=60, max_entries=5)
    victim = ("203.0.113.7", "alice")
    for _ in range(3):
        throttle.begin(victim)

    for n in range(20):
        throttle.begin((f"198.51.100.{n}", f"user-{n}"))

    assert throttle.retry_after(victim) > 0


def test_new_keys_are_refused_while_every_tracked_key_is_locked(clock):
    throttle = LoginThrottle(
        max_attempts=1, lockout_seconds=60, max_entries=4, max_attempts_per_client=1
    )
    for n in range(2):
        throttle.begin((f"198.51.100.{n}", "x"))  # each locks its key and its client

    assert throttle.begin(("192.0.2.1", "newcomer")) > 0


def test_each_client_has_a_budget_across_all_usernames(clock):
    throttle = LoginThrottle(max_attempts=3, lockout_seconds=60, max_attempts_per_client=4)
    for n in range(4):
        assert throttle.begin(("203.0.113.7", f"user-{n}")) == 0

    assert throttle.begin(("203.0.113.7", "someone-else")) > 0
    assert throttle.begin(("198.51.100.1", "someone-else")) == 0


def test_successful_logins_do_not_use_up_the_client_budget(clock):
    throttle = LoginThrottle(max_attempts=3, lockout_seconds=60, max_attempts_per_client=2)
    for n in range(10):
        key = ("203.0.113.7", f"user-{n}")
        assert throttle.begin(key) == 0
        throttle.record_success(key)
