const configuredBase = import.meta.env?.VITE_BASE_API ?? "";

export const API_BASE_URL = configuredBase.replace(/\/$/, "");
export const API_TIMEOUT = Number(import.meta.env?.VITE_API_TIMEOUT ?? 15000);
