/** Build-time configuration. Only VITE_* variables are exposed to the browser. */
export const config = Object.freeze({
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, ""),
  // Must match the backend's BUSINESS_TIMEZONE so "today" is the same day on both sides.
  businessTimeZone: import.meta.env.VITE_BUSINESS_TIMEZONE || "Asia/Kolkata",
})
