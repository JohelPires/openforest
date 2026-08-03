from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Query


@dataclass
class Pagination:
    offset: int
    limit: int


def get_pagination(
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Pagination:
    return Pagination(offset=offset, limit=limit)


PaginationDep = Annotated[Pagination, Depends(get_pagination)]
