import React, { useState } from "react";
import api from "../api";
import "./Login.css";

const extractErrMsg = (err) => {
  const d = err?.response?.data;
  if (!d) return err?.message || "Login failed";
  if (typeof d === "string") return d;
  if (typeof d.detail === "string") return d.detail;
  if (Array.isArray(d.detail)) {
    const msgs = d.detail.map((e) => e?.msg || JSON.stringify(e));
    return msgs.join(", ");
  }
  return JSON.stringify(d);
};

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const body = new URLSearchParams();
      body.append("grant_type", "password"); // required by OAuth2PasswordRequestForm
      body.append("username", username);
      body.append("password", password);
      body.append("scope", "");               // ok to be empty
      body.append("client_id", "");           // optional
      body.append("client_secret", "");       // optional

      const { data } = await api.post("/auth/login", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const token = data.access_token || data.token;
      if (!token) throw new Error("No token returned from server");
      localStorage.setItem("token", token);

      // Optional: fetch current user
      let me = null;
      try {
        const res = await api.get("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        me = res.data;
      } catch {}

      if (onLogin) onLogin(me);
      window.location.href = "/dashboard"; // React route; backend doesn’t need this endpoint
    } catch (err) {
      setError(extractErrMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">AIR QA Portal</h1>
          <p className="login-subtitle">Sign in to continue</p>
        </div>

        {error ? <div className="error-message">{String(error)}</div> : null}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="form-input"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
