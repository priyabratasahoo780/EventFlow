/**
 * travelService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Estimates travel time from user location to event location using Haversine
 * distance + realistic speed heuristics. No paid APIs required.
 *
 * Speed model:
 *   < 1 km   → walking  @ 5 km/h
 *   1–5 km   → cycling  @ 15 km/h
 *   > 5 km   → driving  @ 40 km/h (urban avg)
 *
 * BUFFER: 7 minutes added for preparation time.
 */

import { Event } from '../models/Event';

export type TravelMode = 'walking' | 'cycling' | 'driving';

export interface DepartureSuggestion {
  eventTitle: string;
  eventTimeMs: number;        // epoch ms of event deadline
  travelMins: number;         // estimated travel minutes
  bufferMins: number;         // safety buffer
  totalMins: number;          // travelMins + bufferMins
  leaveByMs: number;          // epoch ms when user should leave
  leaveInMins: number;        // minutes from now until departure
  distanceKm: number;
  mode: TravelMode;
  isUrgent: boolean;          // true if leaveInMins < 15
  isMissed: boolean;          // true if already past departure time
}

const BUFFER_MINS = 7;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function modeAndSpeed(distKm: number): { mode: TravelMode; speedKmH: number } {
  if (distKm < 1) return { mode: 'walking', speedKmH: 5 };
  if (distKm < 5) return { mode: 'cycling', speedKmH: 15 };
  return { mode: 'driving', speedKmH: 40 };
}

export function estimateTravelMins(
  userLat: number,
  userLon: number,
  destLat: number,
  destLon: number
): { travelMins: number; distanceKm: number; mode: TravelMode } {
  const distKm = haversineKm(userLat, userLon, destLat, destLon);
  const { mode, speedKmH } = modeAndSpeed(distKm);
  const travelMins = Math.ceil((distKm / speedKmH) * 60);
  return { travelMins, distanceKm: Math.round(distKm * 10) / 10, mode };
}

export function getDepartureSuggestion(
  event: Event,
  userLat: number,
  userLon: number
): DepartureSuggestion | null {
  if (!event.locationDetails?.latitude || !event.locationDetails?.longitude) return null;
  if (!event.date || !event.time) return null;

  const dateStr = event.date.split('T')[0];
  const timeStr = event.time.length <= 5 ? event.time + ':00' : event.time;
  const eventTimeMs = new Date(dateStr + 'T' + timeStr).getTime();

  const { travelMins, distanceKm, mode } = estimateTravelMins(
    userLat, userLon,
    event.locationDetails.latitude,
    event.locationDetails.longitude
  );

  const totalMins = travelMins + BUFFER_MINS;
  const leaveByMs = eventTimeMs - totalMins * 60 * 1000;
  const leaveInMins = Math.round((leaveByMs - Date.now()) / 60000);

  return {
    eventTitle: event.title,
    eventTimeMs,
    travelMins,
    bufferMins: BUFFER_MINS,
    totalMins,
    leaveByMs,
    leaveInMins,
    distanceKm,
    mode,
    isUrgent: leaveInMins > 0 && leaveInMins < 15,
    isMissed: leaveInMins <= 0,
  };
}

/** Format "Leave by HH:MM" label */
export function formatLeaveBy(leaveByMs: number): string {
  const d = new Date(leaveByMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return hh + ':' + mm;
}

/** Mode emoji */
export function modeEmoji(mode: TravelMode): string {
  if (mode === 'walking') return '🚶';
  if (mode === 'cycling') return '🚲';
  return '🚗';
}
