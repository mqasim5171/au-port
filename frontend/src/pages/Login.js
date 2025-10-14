import React, { useState } from "react";
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const u = username.trim();
    if (!u || !password) {
      setError("Please enter username/email and password");
      return;
    }

    setBusy(true);
    try {
      // 1) Login
      const { data } = await api.post(
        "/auth/login",
        { username: u, password },
        { headers: { "Content-Type": "application/json" } }
      );

      const token = data?.access_token || data?.token;
      if (!token) throw new Error("No token returned by server");

      // 2) Persist the token AND force it for the very next call
      localStorage.setItem("token", token);
      api.defaults.headers.common.Authorization = `Bearer ${token}`;

      // 3) Fetch me with an explicit header to avoid interceptor timing issues
      const meResp = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (onLogin) onLogin(meResp.data);

      // 4) Navigate only after both succeed
      navigate("/", { replace: true });
    } catch (err) {
      // Show the real server message if present
      const status = err?.response?.status;
      const server = err?.response?.data;
      console.error("LOGIN ERROR:", status, server || err?.message || err);

      let msg =
        server?.detail ||
        server?.message ||
        (status === 401 ? "Invalid username/email or password" : null) ||
        err?.message ||
        "Login failed";
      setError(msg);
    } finally {
      setBusy(false);
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && !busy) handleSubmit(e);
              }}
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
