from collections.abc import Sequence
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Paginated(BaseModel, Generic[T]):
    items: Sequence[T]
    total: int
    offset: int
    limit: int
