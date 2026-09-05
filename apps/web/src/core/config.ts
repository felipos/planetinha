/**
 * Automatic re-fetch interval for the Snapshot. Five minutes: the Budget constraint that
 * justified thirty applied to the upstream weather provider, and this app no longer talks to
 * one — it asks Planetinha's own backend, where a request costs nothing upstream. A new hour's
 * Forecasts therefore appear within a few minutes rather than lagging reality by half an hour.
 */
export const TEMPERATURE_REFRESH_INTERVAL_MS = 5 * 60 * 1000
