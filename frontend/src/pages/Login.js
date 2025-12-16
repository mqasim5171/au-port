import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "../App.css";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState(""); // username OR email
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const submittedRef = useRef(false); // prevent double submits

  const extractErr = (err) => {
    const status = err?.response?.status;
    const data = err?.response?.data;

    const detailList = Array.isArray(data?.detail)
      ? data.detail.map((x) => x?.msg).filter(Boolean).join(", ")
      : null;

    return (
      detailList ||
      (typeof data?.detail === "string" ? data.detail : null) ||
      data?.message ||
      (status === 401 ? "Invalid username/email or password" : null) ||
      err?.message ||
      "Login failed"
    );
  };

  const normalizeIdentifier = (raw) => {
    const v = (raw || "").trim();
    if (!v) return "";

    // If user typed an email -> make it lowercase (emails are case-insensitive)
    if (v.includes("@")) return v.toLowerCase();

    // Username: keep as-is (or you can do v.toLowerCase() if you want case-insensitive usernames)
    return v;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Guard: prevent double submit
    if (submittedRef.current || busy) return;

    setError("");

    const identifier = normalizeIdentifier(username);
    if (!identifier || !password) {
      setError("Please enter username/email and password");
      return;
    }

    setBusy(true);
    submittedRef.current = true;

    try {
      // --- STEP 1: LOGIN (works with username OR email)
      const { data } = await api.post(
        "/auth/login",
        { username: identifier, password }, // ✅ backend expects 'username' field even if it's email
        { headers: { "Content-Type": "application/json" } }
      );

      const token = data?.access_token || data?.token;
      if (!token) throw new Error("No token returned by server");

      // Save token
      localStorage.setItem("token", token);
      api.defaults.headers.common.Authorization = `Bearer ${token}`;

      // --- STEP 2: Prefer user object from login response (your backend returns it)
      if (data?.user && onLogin) {
        try {
          onLogin(data.user);
        } catch (onLoginErr) {
          // eslint-disable-next-line no-console
          console.warn("onLogin handler error (non-fatal):", onLoginErr);
        }
      } else {
        // fallback: fetch /auth/me
        try {
          const meResp = await api.get("/auth/me");
          if (onLogin) onLogin(meResp.data);
        } catch (meErr) {
          // eslint-disable-next-line no-console
          console.warn(
            "Non-fatal /auth/me error:",
            meErr?.response?.status,
            meErr?.response?.data || meErr?.message
          );
        }
      }

      // Navigate after login
      navigate("/", { replace: true });
    } catch (err) {
      const msg = extractErr(err);
      setError(msg);
      submittedRef.current = false; // allow retry
    } finally {
      setBusy(false);
      // if login succeeded, keep submittedRef true; if failed we already reset above
    }
  };

  return (
    <div className="login-container">
      <div className="login-animation">
        <DotLottieReact
          src="https://lottie.host/8e27a9ca-5930-40a4-b5dc-f9e769ad09b2/2JJ5qDWACb.lottie"
          loop
          autoplay
          className="login-lottie"
        />
      </div>

      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">AIR QA Portal</h1>
          <p className="login-subtitle">Sign in to continue</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">USERNAME / EMAIL</label>
            <input
              className="form-input"
              placeholder="Enter username or email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={busy}
            />
          </div>

          <div className="form-group">
            <label className="form-label">PASSWORD</label>
            <input
              className="form-input"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={busy}
            />
          </div>

          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
