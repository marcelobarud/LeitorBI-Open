from __future__ import annotations

import os
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock

from fastapi import Request


WINDOW_SECONDS = 60
MAX_TRACKED_CLIENTS = 10_000
TRUE_VALUES = {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class RateLimitRule:
    limit: int
    window_seconds: int = WINDOW_SECONDS


DEFAULT_RULES: dict[str, RateLimitRule] = {
    "/api/models/analyze": RateLimitRule(10),
    "/api/models/compare": RateLimitRule(5),
    "/api/models/export-excel": RateLimitRule(5),
    "/api/public/demo/analyze": RateLimitRule(30),
}


def environment_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return value.strip().lower() in TRUE_VALUES


def trust_proxy_headers() -> bool:
    return environment_flag("LEITORBI_TRUST_PROXY_HEADERS", default=False)


def client_key(request: Request) -> str:
    if trust_proxy_headers():
        forwarded_for = request.headers.get("x-forwarded-for", "")
        forwarded_client = forwarded_for.split(",", 1)[0].strip()
        if forwarded_client:
            return forwarded_client

    return request.client.host if request.client else "unknown"


def _configured_limit(path: str, default: RateLimitRule) -> RateLimitRule:
    key = {
        "/api/models/analyze": "LEITORBI_RATE_LIMIT_ANALYZE",
        "/api/models/compare": "LEITORBI_RATE_LIMIT_COMPARE",
        "/api/models/export-excel": "LEITORBI_RATE_LIMIT_EXPORT",
        "/api/public/demo/analyze": "LEITORBI_RATE_LIMIT_DEMO",
    }.get(path)
    if not key:
        return default

    try:
        return RateLimitRule(max(1, int(os.getenv(key, str(default.limit)))))
    except ValueError:
        return default


class InMemoryRateLimiter:
    """Best-effort limiter for the single-instance public preview."""

    def __init__(self, rules: dict[str, RateLimitRule] | None = None):
        self.rules = rules or DEFAULT_RULES
        self._events: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, request: Request, now: float | None = None) -> tuple[bool, int]:
        rule = self.rules.get(request.url.path)
        if rule is None or request.method.upper() not in {"GET", "POST"}:
            return True, 0

        rule = _configured_limit(request.url.path, rule)
        current = time.monotonic() if now is None else now
        key = (client_key(request), request.url.path)

        with self._lock:
            self._prune(current)
            events = self._events[key]
            while events and events[0] <= current - rule.window_seconds:
                events.popleft()

            if len(events) >= rule.limit:
                retry_after = max(1, int(rule.window_seconds - (current - events[0])))
                return False, retry_after

            events.append(current)
            return True, 0

    def _prune(self, now: float) -> None:
        if len(self._events) <= MAX_TRACKED_CLIENTS:
            return
        cutoff = now - WINDOW_SECONDS
        stale_keys = [
            key for key, events in self._events.items()
            if not events or events[-1] <= cutoff
        ]
        for key in stale_keys:
            self._events.pop(key, None)


rate_limiter = InMemoryRateLimiter()
