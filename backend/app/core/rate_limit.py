"""Shared SlowAPI limiter instance; attach to `app.state` in `main.py` and decorate routes with `@limiter.limit`."""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
