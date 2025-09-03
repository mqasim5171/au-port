import React, { useState } from "react";
import "./Login.css";

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onLogin) {
      onLogin(username, password);
    }
  };

  return (
    <div className="main-container">
      {/* Header with logo & title */}
      <div className="header">
        <img src="C:\Users\SiliCon\OneDrive\Desktop\frontend1\public\air-university-logo-1.png" alt="Air University Logo" className="logo" />
      </div>
      <h1>NCEAC Quality Assurance Portal</h1>
      {/* Login Box */}
      <div className="login-box">
        <h2>Sign in to your Account</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div className="input-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <div className="links">
            <a href="/register">Register</a>
            <a href="/forgot">Forgot Password?</a>
          </div>
          <button type="submit" className="login-btn">Login</button>
        </form>
      </div>
    </div>
  );
};

export default Login;
