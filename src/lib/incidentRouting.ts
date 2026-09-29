import type { PublicIncident } from "@/lib/communityEmergency";

export type RoadAvoidancePoint = {
  incidentId: string;
  lat: number;
  lng: number;
  impact: "difficult" | "closed";
  verification: string;
  updatedAt: string;
  stale: boolean;
};

export function roadAvoidancePoints(incidents: PublicIncident[], now = Date.now()): RoadAvoidancePoint[] {
  return incidents.flatMap((incident) => {
    if (incident.public_lat === null || incident.public_lng === null) return [];
    if (incident.road_impact !== "difficult" && incident.road_impact !== "closed") return [];
    if (incident.verification_state === "disputed") return [];
    const ageMs = Math.max(0, now - new Date(incident.updated_at).getTime());
    return [{
      incidentId: incident.incident_id,
      lat: incident.public_lat,
      lng: incident.public_lng,
      impact: incident.road_impact,
      verification: incident.verification_state || "unverified",
      updatedAt: incident.updated_at,
      stale: ageMs > 6 * 60 * 60 * 1000,
    }];
  });
}

export function googleDirectionsWithWaypoints(
  destination: { lat: number; lng: number },
  origin?: { lat: number; lng: number } | null,
): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
  });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
