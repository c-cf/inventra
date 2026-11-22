"""Upper bounds for numbers in requests.

SQLite INTEGER is 64-bit; anything larger overflows inside the sqlite3 driver
and surfaces as a 500 instead of a validation error.
"""

MAX_ID = 2**63 - 1
MAX_QUANTITY = 1_000_000_000
MAX_PRICE = 1_000_000_000.0
