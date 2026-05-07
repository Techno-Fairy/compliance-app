export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/v1";

export const DEADLINE_CATEGORIES = ["BURS", "CIPA", "LABOUR", "CUSTOM"] as const;
export type DeadlineCategory = (typeof DEADLINE_CATEGORIES)[number];

export const DEADLINE_STATUSES = ["pending", "complete", "missed"] as const;
export type DeadlineStatus = (typeof DEADLINE_STATUSES)[number];
