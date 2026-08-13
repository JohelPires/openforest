from typing import Any, cast

from geoalchemy2.elements import WKBElement
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import mapping, shape


def to_geometry(geojson: dict[str, Any] | None) -> WKBElement | None:
    if geojson is None:
        return None
    geom = shape(geojson)
    if geom.geom_type not in ("Polygon", "MultiPolygon"):
        geom = geom.buffer(0.005).envelope
    return from_shape(geom, srid=4326)


def to_geojson(geometry: object | None) -> dict[str, Any] | None:
    if not isinstance(geometry, WKBElement):
        return None
    return cast(dict[str, Any], mapping(to_shape(geometry)))
