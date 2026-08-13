export type PolygonGeometry = {
  type: "Polygon";
  coordinates: number[][][];
};

const MIN_RING_POINTS = 4;

export function isPolygonGeometry(value: unknown): value is PolygonGeometry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<PolygonGeometry>;
  if (candidate.type !== "Polygon") return false;
  if (!Array.isArray(candidate.coordinates) || candidate.coordinates.length === 0) {
    return false;
  }
  return candidate.coordinates.every((ring) => {
    if (!Array.isArray(ring) || ring.length < MIN_RING_POINTS) return false;
    return ring.every((position) => {
      if (!Array.isArray(position) || position.length < 2) return false;
      return position.every((n) => typeof n === "number" && Number.isFinite(n));
    });
  });
}

export function polygonBounds(
  polygon: PolygonGeometry,
): [west: number, south: number, east: number, north: number] {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const ring of polygon.coordinates) {
    for (const [lng, lat] of ring) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }
  return [west, south, east, north];
}
