// --- Diagnósticos ---
export type DiagnosisType =
  | 'TEA'
  | 'TDAH'
  | 'AACC'
  | 'DISLEXIA'
  | 'AUTOIDENTIFIED'
  | 'OTHER';

// --- Energía ---
export type EnergyLevel = 1 | 2 | 3;

// --- Notificaciones ---
export type NotificationLevel = 1 | 2 | 3;

// --- Swipe ---
export type SwipeDirection = 'like' | 'pass';

// --- Match ---
export type MatchStatus = 'active' | 'unmatched';

// --- Esencias ---
export type EsenciaRarity = 'comun' | 'raro' | 'epico' | 'legendario' | 'premium';
export type EsenciaCategory = 'social' | 'hito' | 'temporal' | 'legado' | 'exclusivo';

// --- Venues ---
export type VenueCategory = 'cafe' | 'library' | 'park' | 'restaurant' | 'other';
export type SensoryLevel = 1 | 2 | 3 | 4 | 5;

// --- Health ---
export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
  timestamp: string;
}

// --- API Error ---
export interface ApiError {
  code: string;
  message: string;
}
