/**
 * LoginScreen.jsx
 * ─────────────────────────────────────────────────────────────
 * Exclusive entry-point for DataAgent.
 *
 * On mount it pings  GET /api/auth/session:
 *   • 200  → already authenticated  → call onLogin(user)
 *   • 401  → no valid session       → render login form
 *
 * On form submit it calls  POST /api/auth/login:
 *   • 200  → credentials ok         → call onLogin(user)
 *   • 401  → bad credentials        → show inline error
 */

import React, { useState, useEffect, useRef } from "react";

// const AUTH_BASE = "http://localhost:8000/api/auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const AUTH_BASE = `${API_BASE_URL}/api/auth`;

// ─── tiny SVG icons ───────────────────────────────────────────────────────────

const IconLock = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IconUser = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconEye = ({ off }) => off ? (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
) : (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
          style={{ transformOrigin: "center", animation: "spin 0.8s linear infinite" }}/>
  </svg>
);

// ─── styles (inline, no external CSS needed) ─────────────────────────────────

const styles = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "#0A0F1E",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    overflow: "hidden",
  },
  // abstract grid lines in background
  gridBg: {
    position: "absolute", inset: 0, pointerEvents: "none",
    backgroundImage: `
      linear-gradient(rgba(37,99,235,0.07) 1px, transparent 1px),
      linear-gradient(90deg, rgba(37,99,235,0.07) 1px, transparent 1px)
    `,
    backgroundSize: "48px 48px",
  },
  glowBlob: {
    position: "absolute",
    width: 520, height: 520,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 70%)",
    top: "50%", left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  card: {
    position: "relative", zIndex: 1,
    width: 420,
    background: "rgba(15,23,42,0.85)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(37,99,235,0.25)",
    borderRadius: 20,
    padding: "48px 44px 44px",
    boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
  },
  logo: {
    display: "flex", alignItems: "center", gap: 10, marginBottom: 36,
  },
  logoMark: {
    width: 38, height: 38, borderRadius: 10,
    background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 4px 12px rgba(37,99,235,0.45)",
  },
  logoText: {
    fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px",
    color: "#F8FAFC",
  },
  logoSub: {
    fontSize: 11, color: "#64748B", letterSpacing: "0.5px",
    textTransform: "uppercase", marginTop: -2,
  },
  heading: {
    fontSize: 24, fontWeight: 700, color: "#F1F5F9",
    letterSpacing: "-0.5px", marginBottom: 6,
  },
  subheading: {
    fontSize: 13, color: "#64748B", marginBottom: 32,
    lineHeight: 1.5,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    display: "block", fontSize: 12, fontWeight: 600,
    color: "#94A3B8", letterSpacing: "0.5px",
    textTransform: "uppercase", marginBottom: 8,
  },
  inputWrap: {
    position: "relative",
    display: "flex", alignItems: "center",
  },
  inputIcon: {
    position: "absolute", left: 14,
    color: "#475569", pointerEvents: "none",
    display: "flex", alignItems: "center",
  },
  input: (focused, error) => ({
    width: "100%",
    background: "rgba(30,41,59,0.8)",
    border: `1.5px solid ${error ? "#EF4444" : focused ? "#2563EB" : "rgba(51,65,85,0.8)"}`,
    borderRadius: 10,
    padding: "11px 14px 11px 42px",
    fontSize: 14, color: "#F1F5F9",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxShadow: focused && !error ? "0 0 0 3px rgba(37,99,235,0.15)" : "none",
    caretColor: "#2563EB",
    boxSizing: "border-box",
  }),
  eyeBtn: {
    position: "absolute", right: 12,
    background: "none", border: "none", cursor: "pointer",
    color: "#475569", padding: 4, borderRadius: 6,
    display: "flex", alignItems: "center",
    transition: "color 0.15s",
  },
  errorMsg: {
    marginTop: 20,
    padding: "11px 14px",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 10, fontSize: 13, color: "#FCA5A5",
    display: "flex", alignItems: "center", gap: 8,
  },
  submitBtn: (loading) => ({
    width: "100%", marginTop: 26,
    padding: "13px",
    background: loading
      ? "rgba(37,99,235,0.5)"
      : "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
    border: "none", borderRadius: 10,
    fontSize: 14, fontWeight: 600, color: "#fff",
    cursor: loading ? "not-allowed" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    transition: "opacity 0.2s, transform 0.1s",
    boxShadow: loading ? "none" : "0 4px 16px rgba(37,99,235,0.35)",
    letterSpacing: "0.2px",
  }),
  divider: {
    height: 1,
    background: "rgba(51,65,85,0.5)",
    margin: "28px 0 20px",
  },
  notice: {
    display: "flex", alignItems: "flex-start", gap: 8,
    fontSize: 12, color: "#475569", lineHeight: 1.5,
  },
  noticeDot: {
    width: 5, height: 5, borderRadius: "50%",
    background: "#334155", flexShrink: 0, marginTop: 5,
  },
};

// ─── keyframes injected once ─────────────────────────────────────────────────

if (typeof document !== "undefined" && !document.getElementById("_da_login_kf")) {
  const el = document.createElement("style");
  el.id = "_da_login_kf";
  el.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeSlide {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    ._da_card_anim { animation: fadeSlide 0.45s cubic-bezier(0.16,1,0.3,1) both; }
    ._da_submit_btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
    ._da_submit_btn:active:not(:disabled) { transform: translateY(0); }
    ._da_eye:hover { color: #94A3B8 !important; }
  `;
  document.head.appendChild(el);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginScreen({ onLogin }) {
  const [checkingSession, setCheckingSession] = useState(true);
  const [username, setUsername]   = useState("");
  const [password, setPassword]   = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [focusedField, setFocused] = useState(null);

  const userRef = useRef(null);

  // ── 1. Check for existing session on mount ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${AUTH_BASE}/session`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          onLogin(data.user);          // already logged in → skip form
          return;
        }
      } catch (_) { /* network error — show form */ }
      setCheckingSession(false);
      setTimeout(() => userRef.current?.focus(), 80);
    })();
  }, []);

  // ── 2. Submit credentials ────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${AUTH_BASE}/login`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (res.ok) {
        onLogin(data.user);
      } else {
        setError(data.detail || "Invalid credentials. Please try again.");
        setPassword("");
      }
    } catch {
      setError("Unable to reach the server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  // ── Splash while we check the session ───────────────────────────────────
  if (checkingSession) {
    return (
      <div style={{ ...styles.overlay, flexDirection: "column", gap: 14 }}>
        <div style={styles.glowBlob} />
        <div style={styles.gridBg} />
        <SpinnerIcon />
        <span style={{ color: "#475569", fontSize: 13, letterSpacing: "0.3px" }}>
          Verifying session…
        </span>
      </div>
    );
  }

  // ── Login form ───────────────────────────────────────────────────────────
  return (
    <div style={styles.overlay}>
      <div style={styles.glowBlob} />
      <div style={styles.gridBg} />

      <div style={styles.card} className="_da_card_anim">

        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoMark}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
            </svg>
          </div>
          <div>
            <div style={styles.logoText}>DataAgent</div>
            <div style={styles.logoSub}>Intelligence Platform</div>
          </div>
        </div>

        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.subheading}>
          Sign in with your official credentials to continue.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} autoComplete="off">

          {/* Username */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Username</label>
            <div style={styles.inputWrap}>
              <span style={styles.inputIcon}><IconUser /></span>
              <input
                ref={userRef}
                type="text"
                autoComplete="username"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(""); }}
                onFocus={() => setFocused("user")}
                onBlur={() => setFocused(null)}
                style={styles.input(focusedField === "user", !!error)}
                placeholder="your.username"
                disabled={loading}
              />
            </div>
          </div>

          {/* Password */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrap}>
              <span style={styles.inputIcon}><IconLock /></span>
              <input
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                onFocus={() => setFocused("pass")}
                onBlur={() => setFocused(null)}
                style={{ ...styles.input(focusedField === "pass", !!error), paddingRight: 40 }}
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button"
                className="_da_eye"
                style={styles.eyeBtn}
                onClick={() => setShowPass(v => !v)}
                tabIndex={-1}
              >
                <IconEye off={showPass} />
              </button>
            </div>
          </div>

          {/* Inline error */}
          {error && (
            <div style={styles.errorMsg}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="_da_submit_btn"
            style={styles.submitBtn(loading)}
          >
            {loading
              ? <><SpinnerIcon /> Verifying…</>
              : "Sign in to DataAgent"
            }
          </button>
        </form>

        {/* Footer notice */}
        <div style={styles.divider} />
        <div style={styles.notice}>
          <div style={styles.noticeDot} />
          <span>
            Access is restricted to pre-registered officials only.
            Contact your administrator to request an account.
          </span>
        </div>

      </div>
    </div>
  );
}
