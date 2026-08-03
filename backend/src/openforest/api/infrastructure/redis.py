from redis import Redis

from openforest.api.config import settings

_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.redis_url)
    return _redis


def blacklist_token(jti: str, expires_in: int) -> None:
    r = get_redis()
    r.setex(f"token_blacklist:{jti}", expires_in, "blacklisted")


def is_token_blacklisted(jti: str) -> bool:
    r = get_redis()
    return bool(r.exists(f"token_blacklist:{jti}"))
