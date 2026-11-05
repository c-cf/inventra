"""Shared FastAPI dependencies, exposed as Annotated aliases for route signatures."""

import sqlite3
from typing import Annotated

from fastapi import Depends

from app.db import get_db

DbConn = Annotated[sqlite3.Connection, Depends(get_db)]
