// src/api.js
import axios from "axios";

// Prefer Vite's env var if available, else CRA's, else default:
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: API_BASE,     // origin only; don't append '/auth' here
  withCredentials: false // using bearer tokens, not cookies
});

// Attach token if present; also log the final URL for debugging
api.interceptors.request.use((config) => {
  const t = localStorage.getItem("token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("API REQUEST ->", (config.baseURL || "") + (config.url || ""));
  }
  return config;
});

export default api;
