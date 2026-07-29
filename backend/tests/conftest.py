from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient

from openforest.api.main import app


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as c:
        yield c
