import React, { useState } from "react";
import api from "../api";
import "../App.css";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

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
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("token", data.token || data.access_token);
      if (onLogin) onLogin(data.user);
      window.location.href = "/auth/me";
    } catch (err) {
      setError(err?.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-container">
      {/* 🔹 Left side Lottie Animation */}
      <div className="login-animation">
        <DotLottieReact
          src="https://lottie.host/8e27a9ca-5930-40a4-b5dc-f9e769ad09b2/2JJ5qDWACb.lottie"
          loop
          autoplay
          className="login-lottie"
        />
      </div>

      {/* 🔹 Right side Form */}
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">AIR QA Portal</h1>
          <p className="login-subtitle">Sign in to continue</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">USERNAME:</label>
            <input
              className="form-input"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label className="form-label">PASSWORD :</label>
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
