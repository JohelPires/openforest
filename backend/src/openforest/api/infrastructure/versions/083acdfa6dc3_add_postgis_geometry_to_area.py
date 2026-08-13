"""add postgis geometry to area

Revision ID: 083acdfa6dc3
Revises: a2625b3dea29
Create Date: 2026-08-11 09:48:32.367930

"""
import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from geoalchemy2.types import Geometry
from shapely.geometry import shape
from shapely.wkt import dumps

# revision identifiers, used by Alembic.
revision: str = '083acdfa6dc3'
down_revision: Union[str, Sequence[str], None] = 'a2625b3dea29'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _geometry_from_json(coordinates: dict) -> str | None:
    if "lat" in coordinates and "lng" in coordinates:
        geojson = {"type": "Point", "coordinates": [coordinates["lng"], coordinates["lat"]]}
    else:
        geojson = coordinates
    geom = shape(geojson)
    if geom.geom_type not in ("Polygon", "MultiPolygon"):
        geom = geom.buffer(0.005).envelope
    return dumps(geom)


def _migrate_data() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text("SELECT id, coordinates FROM area WHERE coordinates IS NOT NULL")
    ).fetchall()
    for row in rows:
        if not isinstance(row.coordinates, dict):
            continue
        wkt = _geometry_from_json(row.coordinates)
        bind.execute(
            sa.text("UPDATE area SET geometry = ST_GeomFromText(:wkt, 4326) WHERE id = :id"),
            {"wkt": wkt, "id": row.id},
        )


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.add_column(
        "area", sa.Column("geometry", Geometry(srid=4326, spatial_index=False), nullable=True)
    )
    _migrate_data()
    op.drop_column("area", "coordinates")
    op.create_index("ix_area_geometry", "area", ["geometry"], postgresql_using="gist")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_area_geometry", table_name="area")
    op.add_column("area", sa.Column("coordinates", sa.JSON(), nullable=True))
    bind = op.get_bind()
    rows = bind.execute(
        sa.text("SELECT id, ST_AsGeoJSON(geometry) AS geojson FROM area WHERE geometry IS NOT NULL")
    ).fetchall()
    for row in rows:
        geom = shape(json.loads(row.geojson))
        point = geom.centroid
        bind.execute(
            sa.text("UPDATE area SET coordinates = :coordinates WHERE id = :id"),
            {"coordinates": {"lat": point.y, "lng": point.x}, "id": row.id},
        )
    op.drop_column("area", "geometry")
