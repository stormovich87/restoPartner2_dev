import { CourierDeliveryZone, PerformerDeliveryZone } from '../types';

export function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>
): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

export function findCourierZoneForPoint(
  point: { lat: number; lng: number },
  zones: CourierDeliveryZone[]
): CourierDeliveryZone | null {
  const matchingZones = zones.filter(zone => isPointInPolygon(point, zone.polygon));

  if (matchingZones.length === 0) return null;

  return matchingZones[0];
}

export function calculateCourierDeliveryPrice(
  point: { lat: number; lng: number },
  zones: CourierDeliveryZone[]
): number | null {
  const zone = findCourierZoneForPoint(point, zones);
  return zone ? zone.price_uah : null;
}
