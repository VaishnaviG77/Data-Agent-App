import React, { useState, useEffect, useRef, useCallback } from "react";
import LoginScreen from "./LoginScreen";

// const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// const API_BASE = `${API_BASE_URL}/api/ingest`;

const API_BASE_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : "http://localhost:8000";

const API_BASE = `${API_BASE_URL}/api/ingest`;

console.log("Current API URL:", API_BASE_URL);

const COLORS = {
  bg: "#F8F9FC",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F3F8",
  sidebar: "#0F172A",
  sidebarHover: "#1E293B",
  sidebarActive: "#2563EB",
  primary: "#2563EB",
  primaryLight: "#DBEAFE",
  primaryDark: "#1D4ED8",
  text: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  success: "#10B981",
  successLight: "#D1FAE5",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  error: "#EF4444",
  errorLight: "#FEE2E2",
  amber: "#D97706",
  amberLight: "#FDE68A",
};

const FONTS = {
  display: "'DM Sans', sans-serif",
  body: "'DM Sans', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

// Icons
const Icons = {
  Database: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
  Mapping: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h6v6H3z"/><path d="M15 15h6v6h-6z"/><path d="M9 6h6"/><path d="M15 6v9"/><path d="M9 18h6"/>
    </svg>
  ),
  Sparkle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>
    </svg>
  ),
  Chart: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
    </svg>
  ),
  Upload: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  X: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Filter: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  ),
  Settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2m-9-11h2m18 0h2m-3.636-6.364l-1.414 1.414M6.05 17.95l-1.414 1.414m0-13.728l1.414 1.414m11.314 11.314l1.414 1.414"/>
    </svg>
  ),
  Alert: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Grip: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
    </svg>
  ),
  ArrowRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  Bell: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Chevron: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Refresh: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
    </svg>
  ),
  Key: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  ),
  File: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
};

const T = {
  navy: "#0B1222", navyMid: "#131D2E", navyLight: "#1A2740",
  s50: "#F7F9FB", s100: "#EEF2F6", s200: "#DEE4EC", s300: "#C2CCD8", s400: "#8E9DB3", s500: "#64748B",
  blue: "#2563EB", blueL: "#3B82F6", blueP: "#DBEAFE", blueG: "#EFF6FF",
  grn: "#16A34A", grnP: "#DCFCE7",
  amb: "#D97706", ambP: "#FEF3C7", ambB: "#FCD34D",
  red: "#DC2626", redP: "#FEE2E2",
  wh: "#FFFFFF",
  f: "'Outfit',sans-serif", m: "'JetBrains Mono','SF Mono',monospace",
};

function Pill({children,color=T.s400,bg=T.s100}){return<span style={{padding:"2px 9px",borderRadius:99,fontSize:10.5,fontWeight:650,letterSpacing:".04em",textTransform:"uppercase",background:bg,color,whiteSpace:"nowrap",lineHeight:"18px",display:"inline-block"}}>{children}</span>}
function XBtn({onClick,danger}){const[h,sH]=useState(false);return<button onClick={onClick} onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)} style={{width:28,height:28,borderRadius:6,border:"none",background:h?(danger?T.redP:T.s100):"transparent",color:h?(danger?T.red:T.navy):T.s400,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:14,transition:"all .15s",padding:0}}>{"\u2715"}</button>}
function ConfBar({value}){const c=value>=90?T.grn:value>=70?T.amb:T.red;return<div style={{display:"flex",alignItems:"center",gap:8}}><div style={{flex:1,height:5,background:T.s100,borderRadius:3,overflow:"hidden"}}><div style={{width:`${value}%`,height:"100%",background:c,borderRadius:3,transition:"width .5s"}}/></div><span style={{fontSize:11.5,fontWeight:700,color:c,minWidth:32,textAlign:"right",fontFamily:T.m}}>{value}%</span></div>}

// Logo components for data sources
const SourceLogos = {
  Shopify: () => (
    <div style={{ width: 36, height: 36, borderRadius: 8, background: "#96BF48", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="20" height="22" viewBox="0 0 20 22" fill="white">
        <path d="M17.5 4.5c-.03-.2-.2-.3-.33-.32-.13-.02-2.8-.2-2.8-.2s-1.87-1.85-2.07-2.05c-.2-.2-.6-.14-.75-.1-.02 0-.4.12-1.07.33C10.1 1.1 9.35.3 8.23.3 5.7.3 4.4 3.45 4 5.1c-1.1.34-1.87.58-1.97.6-.6.19-.62.2-.7.77C1.28 7 0 17.6 0 17.6l12.97 2.4L20 18.17s-2.47-13.4-2.5-13.67zM11.1 2.9l-1.63.5c0-.05 0-.1 0-.15 0-.94-.13-1.7-.35-2.3.87.17 1.45 1.07 1.98 1.95zM8.7 1.13c.23.55.38 1.35.38 2.43 0 .07 0 .14 0 .2l-3.37 1.04C6.2 2.87 7.4 1.53 8.7 1.13zM8.13.6c.13 0 .27.05.4.13C7 1.3 5.87 3 5.5 5.1L3.2 5.8C3.73 3.93 5.2.6 8.13.6z"/>
      </svg>
    </div>
  ),
  Amazon: () => (
    <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FF9900", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 18, color: "#232F3E" }}>a</span>
    </div>
  ),
  Myntra: () => (
    <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FF3F6C", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 16, color: "white" }}>M</span>
    </div>
  ),
  Blinkit: () => (
    <div style={{ width: 36, height: 36, borderRadius: 8, background: "#7F54B3", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 14, color: "white" }}>B</span>
    </div>
  ),
  BigCommerce: () => (
    <div style={{ width: 36, height: 36, borderRadius: 8, background: "#34313F", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 16, color: "white" }}>B</span>
    </div>
  ),
  CSV: () => (
    <div style={{ width: 36, height: 36, borderRadius: 8, background: COLORS.primaryLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 11, color: COLORS.primary }}>CSV</span>
    </div>
  ),
};

const Badge = ({ color, bg, children }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600,
    fontFamily: FONTS.body, color, background: bg, letterSpacing: "0.02em",
  }}>{children}</span>
);

const StatusDot = ({ color }) => (
  <span style={{
    width: 8, height: 8, borderRadius: "50%", background: color,
    display: "inline-block", boxShadow: `0 0 0 3px ${color}22`,
  }} />
);

const ConfidenceBar = ({ value }) => {
  const color = value >= 90 ? COLORS.success : value >= 70 ? COLORS.warning : COLORS.error;
  const bg = value >= 90 ? COLORS.successLight : value >= 70 ? COLORS.warningLight : COLORS.errorLight;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: bg, borderRadius: 100, overflow: "hidden", minWidth: 80 }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 100, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 600, color, minWidth: 36, textAlign: "right" }}>{value}%</span>
    </div>
  );
};

// ── Helper: get file type icon color ──────────────────────────────────────────
function getFileTypeColor(fileType) {
  switch ((fileType || "").toLowerCase()) {
    case "csv":  return { bg: "#D1FAE5", color: "#059669", label: "CSV" };
    case "xlsx": return { bg: "#DBEAFE", color: "#2563EB", label: "XLSX" };
    case "xls":  return { bg: "#FEF3C7", color: "#D97706", label: "XLS" };
    case "json": return { bg: "#EDE9FE", color: "#7C3AED", label: "JSON" };
    default:     return { bg: "#F1F5F9", color: "#64748B", label: (fileType || "FILE").toUpperCase() };
  }
}

// ── File Type Logo ─────────────────────────────────────────────────────────────
const FileTypeLogo = ({ fileType }) => {
  const { bg, color, label } = getFileTypeColor(fileType);
  return (
    <div style={{ width: 36, height: 36, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 10, color }}>{label}</span>
    </div>
  );
};

// ── SCREEN 1: Data Ingestion Hub (REAL API) ────────────────────────────────────
const DataIngestionHub = ({ onFilesChange }) => {
  const [showModal, setShowModal] = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loadingFiles, setLoadingFiles]   = useState(true);
  const [toast, setToast]           = useState(null);
  const fileInputRef                = useRef(null);

  // Load existing files from backend when component mounts
  const fetchFiles = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/files`, {
        credentials: "include" 
      });
      const data = await res.json();
      setUploadedFiles(data.files || []);
      if (onFilesChange) onFilesChange(data.files || []);
    } catch (err) {
      showToast("Could not connect to backend. Is the Python server running?", "error");
    } finally {
      setLoadingFiles(false);
    }
  }, [onFilesChange]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Upload files to backend
  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;

    setUploading(true);

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    try {
      const res  = await fetch(`${API_BASE}/upload`, {
        method : "POST",
        body   : formData,
        credentials: "include",
      });
      const data = await res.json();

      if (data.uploaded > 0) {
        showToast(`✓ ${data.uploaded} file(s) uploaded successfully!`, "success");
      }
      if (data.failed > 0) {
        showToast(`${data.failed} file(s) failed: ${data.errors[0]?.error}`, "error");
      }

      await fetchFiles();
    } catch (err) {
      showToast("Upload failed. Make sure the Python backend is running on port 8000.", "error");
    } finally {
      setUploading(false);
    }
  };

  // Delete a file
  const handleDelete = async (fileId, filename) => {
    if (!window.confirm(`Delete "${filename}"?`)) return;
    try {
      await fetch(`${API_BASE}/files/${fileId}`, { method: "DELETE", credentials: "include" });
      showToast(`Deleted ${filename}`, "success");
      await fetchFiles();
    } catch (err) {
      showToast("Delete failed.", "error");
    }
  };

  // Drag & Drop
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  // File input change
  const handleFileInput = (e) => {
    handleUpload(e.target.files);
    e.target.value = "";
  };

  // Detect platform from filename
  const detectPlatform = (filename) => {
    const n = (filename || "").toLowerCase();
    if (n.includes("shopify"))    return "Shopify";
    if (n.includes("amazon"))     return "Amazon";
    if (n.includes("myntra"))     return "Myntra";
    if (n.includes("blinkit"))    return "Blinkit";
    // if (n.includes("woocommerce") || n.includes("woo")) return "WooCommerce";
    if (n.includes("bigcommerce") || n.includes("big")) return "BigCommerce";
    if (n.includes("flipkart"))   return "Flipkart";
    if (n.includes("meesho"))     return "Meesho";
    return "Manual / CSV";
  };

  // Platform visual config
  const platformConfig = {
    "Shopify":     { color: "#1DB954", bg: "#D1FAE5", icon: "🛍️" },
    "Amazon":      { color: "#FF9900", bg: "#FEF3C7", icon: "📦" },
    "Myntra":      { color: "#E91E8C", bg: "#FCE7F3", icon: "👗" },
    "Blinkit":     { color: "#7F54B3", bg: "#EDE9FE", icon: "🛒" },
    "BigCommerce": { color: "#34495E", bg: "#F1F5F9", icon: "🏪" },
    "Flipkart":    { color: "#2874F0", bg: "#DBEAFE", icon: "🔷" },
    "Meesho":      { color: "#F43F5E", bg: "#FEE2E2", icon: "🏷️" },
    "Manual / CSV":{ color: "#64748B", bg: "#F1F5F9", icon: "📄" },
  };

  // Group uploaded files by detected platform
  const platformStats = uploadedFiles.reduce((acc, f) => {
    const key = detectPlatform(f.filename);
    if (!acc[key]) acc[key] = { name: key, count: 0, rows: 0, files: [] };
    acc[key].count++;
    acc[key].rows += f.row_count || 0;
    acc[key].files.push(f);
    return acc;
  }, {});

  const totalRows = uploadedFiles.reduce((sum, f) => sum + (f.row_count || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          padding: "12px 20px", borderRadius: 10,
          background: toast.type === "error" ? COLORS.errorLight : COLORS.successLight,
          border: `1px solid ${toast.type === "error" ? COLORS.error : COLORS.success}`,
          color: toast.type === "error" ? COLORS.error : COLORS.success,
          fontFamily: FONTS.body, fontSize: 13, fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          maxWidth: 360,
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontFamily: FONTS.display, fontSize: 22, fontWeight: 700, color: COLORS.text, margin: 0 }}>Data Ingestion Hub</h2>
          <p style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, margin: "6px 0 0" }}>
            Upload CSV, Excel, or JSON files. They will be saved to SQLite automatically.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Badge color={COLORS.primary} bg={COLORS.primaryLight}>
            {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""}
          </Badge>
          <Badge color={COLORS.success} bg={COLORS.successLight}>
            {totalRows.toLocaleString()} rows
          </Badge>
        </div>
      </div>

      {/* Platform grid cards grouped by detected platform source */}
      {Object.keys(platformStats).length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {Object.values(platformStats).map((p) => {
            const cfg = platformConfig[p.name] || { color: COLORS.primary, bg: COLORS.primaryLight, icon: "📁" };
            return (
              <div key={p.name} style={{
                background: COLORS.surface, borderRadius: 14, padding: 20,
                border: `1px solid ${cfg.color}30`,
                boxShadow: `0 1px 6px ${cfg.color}10`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                    {cfg.icon}
                  </div>
                  <Badge color={COLORS.success} bg={COLORS.successLight}>
                    <StatusDot color={COLORS.success} /> Active
                  </Badge>
                </div>
                <div style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 2 }}>{p.name}</div>
                <div style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted, marginBottom: 12 }}>
                  {(() => { const s = p.files.map(f => f.filename).join(", "); return s.length > 48 ? s.slice(0, 48) + "…" : s; })()}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: `1px solid ${COLORS.borderLight}` }}>
                  <div>
                    <div style={{ fontFamily: FONTS.body, fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Files</div>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 15, fontWeight: 700, color: cfg.color, marginTop: 2 }}>{p.count}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: FONTS.body, fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Rows</div>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 15, fontWeight: 700, color: cfg.color, marginTop: 2 }}>{p.rows.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Import Data Section */}
      <div style={{ background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <Icons.Upload />
          <span style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: COLORS.text }}>Import Data</span>
          {uploading && (
            <span style={{ marginLeft: "auto", fontFamily: FONTS.body, fontSize: 12, color: COLORS.primary, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 12, height: 12, border: `2px solid ${COLORS.primaryLight}`, borderTopColor: COLORS.primary, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Uploading...
            </span>
          )}
        </div>

        <div style={{ padding: 20 }}>
          {/* Drag & Drop Zone */}
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragOver ? COLORS.primary : uploading ? COLORS.border : COLORS.border}`,
              borderRadius: 12, padding: "40px 32px", textAlign: "center",
              background: dragOver ? COLORS.primaryLight + "44" : COLORS.surfaceAlt,
              transition: "all 0.2s",
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.6 : 1,
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv,.xls,.xlsx,.json"
              onChange={handleFileInput}
              style={{ display: "none" }}
            />
            <div style={{
              width: 56, height: 56, borderRadius: 14, background: COLORS.primaryLight,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 14px", color: COLORS.primary,
            }}>
              <Icons.Upload />
            </div>
            <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 700, color: COLORS.text }}>
              {dragOver ? "Drop files to upload" : "Drop files here or click to browse"}
            </div>
            <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: 6 }}>
              Multiple files supported · CSV, XLS, XLSX, JSON · Max 50MB per file
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16 }}>
              {["CSV", "XLS", "XLSX", "JSON"].map(f => (
                <span key={f} style={{
                  padding: "4px 12px", borderRadius: 6, background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`, fontFamily: FONTS.mono,
                  fontSize: 11, fontWeight: 600, color: COLORS.textSecondary,
                }}>.{f}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Uploaded Files List */}
      {(loadingFiles || uploadedFiles.length > 0) && (
        <div style={{ background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
          <div style={{
            padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icons.File />
              <span style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 600, color: COLORS.text }}>
                Uploaded Files
              </span>
              <span style={{
                padding: "2px 8px", borderRadius: 100, background: COLORS.primaryLight,
                fontFamily: FONTS.mono, fontSize: 11, fontWeight: 700, color: COLORS.primary,
              }}>{uploadedFiles.length}</span>
            </div>
            <button
              onClick={fetchFiles}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                borderRadius: 7, border: `1px solid ${COLORS.border}`, background: "transparent",
                fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, cursor: "pointer",
              }}
            >
              <Icons.Refresh /> Refresh
            </button>
          </div>

          {loadingFiles ? (
            <div style={{ padding: 32, textAlign: "center", color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: 13 }}>
              Loading files...
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div style={{
                display: "grid", gridTemplateColumns: "36px 1fr 80px 80px 100px 100px 100px 60px",
                padding: "10px 20px", background: COLORS.surfaceAlt,
                borderBottom: `1px solid ${COLORS.border}`, gap: 12,
              }}>
                {["", "Filename", "Type", "Size", "Rows", "Columns", "Status", ""].map((h, i) => (
                  <span key={i} style={{
                    fontFamily: FONTS.body, fontSize: 10, fontWeight: 700,
                    color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>{h}</span>
                ))}
              </div>

              {uploadedFiles.map((file) => {
                const ftColor = getFileTypeColor(file.file_type);
                const statusColor = file.status === "uploaded" ? COLORS.success
                  : file.status === "error" ? COLORS.error : COLORS.primary;
                const statusBg = file.status === "uploaded" ? COLORS.successLight
                  : file.status === "error" ? COLORS.errorLight : COLORS.primaryLight;

                return (
                  <div key={file.id} style={{
                    display: "grid",
                    gridTemplateColumns: "36px 1fr 80px 80px 100px 100px 100px 60px",
                    padding: "12px 20px", borderBottom: `1px solid ${COLORS.borderLight}`,
                    alignItems: "center", gap: 12,
                    transition: "background 0.15s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceAlt}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <FileTypeLogo fileType={file.file_type} />

                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontFamily: FONTS.body, fontSize: 13, fontWeight: 600,
                        color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }} title={file.filename}>
                        {file.filename}
                      </div>
                      <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                        {new Date(file.uploaded_at).toLocaleString()}
                      </div>
                    </div>

                    <span style={{
                      padding: "3px 8px", borderRadius: 5, background: ftColor.bg,
                      fontFamily: FONTS.mono, fontSize: 11, fontWeight: 700, color: ftColor.color,
                      width: "fit-content",
                    }}>
                      {ftColor.label}
                    </span>

                    <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textSecondary }}>
                      {file.file_size_kb} KB
                    </span>

                    <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                      {(file.row_count || 0).toLocaleString()}
                    </span>

                    <span style={{ fontFamily: FONTS.mono, fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                      {file.col_count || 0}
                    </span>

                    <Badge color={statusColor} bg={statusBg}>
                      <StatusDot color={statusColor} />
                      {file.status === "uploaded" ? "Ready" : file.status === "error" ? "Error" : file.status}
                    </Badge>

                    <button
                      onClick={() => handleDelete(file.id, file.filename)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: COLORS.textMuted, padding: 6, borderRadius: 6,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = COLORS.errorLight; e.currentTarget.style.color = COLORS.error; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = COLORS.textMuted; }}
                      title="Delete file"
                    >
                      <Icons.Trash />
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loadingFiles && uploadedFiles.length === 0 && (
        <div style={{
          padding: "40px 24px", textAlign: "center",
          background: COLORS.surface, borderRadius: 14, border: `1px dashed ${COLORS.border}`,
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <div style={{ fontFamily: FONTS.display, fontSize: 15, fontWeight: 600, color: COLORS.text }}>No files uploaded yet</div>
          <div style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>
            Use the upload zone above to get started
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
    </div>
  );
};

/* ===== SCREEN 2: MAPPING & CLEANING ===== */
/* ===== SCREEN 2: MAPPING & CLEANING ===== */
function MappingRow({r,stC,stI,T,setHitl}){
  const[h,sH]=useState(false);
  return(
    <div onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)} style={{display:"grid",gridTemplateColumns:"1.2fr 32px 1.2fr 90px 72px",padding:"11px 20px",borderBottom:`1px solid ${T.s100}`,alignItems:"center",background:h&&r.st!=="ok"?T.ambP+"30":"transparent",transition:"background .1s"}}>
      <code style={{fontFamily:T.m,fontSize:12.5,color:T.navy,fontWeight:500}}>{r.s}</code>
      <span style={{textAlign:"center",color:T.s300,fontSize:15}}>{"\u2192"}</span>
      <code style={{fontFamily:T.m,fontSize:12.5,color:r.t==="\u2014"?T.s300:T.navy,fontWeight:500}}>{r.t}</code>
      <Pill>{r.ch}</Pill>
      <div style={{textAlign:"center"}}><span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:26,height:26,borderRadius:6,background:stC[r.st]+"14",color:stC[r.st],fontSize:13,fontWeight:700}}>{stI[r.st]}</span></div>
    </div>
  );
}

function MappingCleaning({ uploadedFiles, refreshKey }){
  const PAGE_SIZE=10;
  const[src,setSrc]=useState("All");
  const[hitl,setHitl]=useState(false);
  const[rows,setRows]=useState([]);
  const[tabs,setTabs]=useState(["All"]);
  const[targets,setTargets]=useState([]);
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[pendingMappings,setPendingMappings]=useState([]);
  const[page,setPage]=useState(0);
  // dropdown selections: { "source_col||platform": targetValue }
  const[dropdownVals,setDropdownVals]=useState({});

  const fetchMappings=useCallback(async()=>{
    setLoading(true);
    try{
      const[rowsRes,tabsRes,tgtRes]=await Promise.all([
        fetch(`${API_BASE.replace("/ingest","")}/mapping/rows`),
        fetch(`${API_BASE.replace("/ingest","")}/mapping/platforms`),
        fetch(`${API_BASE.replace("/ingest","")}/mapping/targets`),
      ]);
      const rowsData=await rowsRes.json();
      const tabsData=await tabsRes.json();
      const tgtData=await tgtRes.json();
      setRows((rowsData||[]).map(r=>({s:r.source_column,t:r.target_field||"\u2014",st:r.status,ch:r.platform})));
      setTabs(tabsData.platforms||["All"]);
      setTargets(tgtData.targets||[]);
      // Reset pending state after data refresh (e.g. after a cascade delete)
      setPendingMappings([]);
      setDropdownVals({});
    }catch(e){}finally{setLoading(false);}
  },[]);

  useEffect(()=>{fetchMappings();},[fetchMappings]);

  // Re-fetch when files change (upload or delete) via refreshKey
  useEffect(()=>{
    if(refreshKey>0){
      fetchMappings();
      setPage(0);
    }
  },[refreshKey,fetchMappings]);

  const vis=src==="All"?rows:rows.filter(r=>r.ch===src);
  const totalPages=Math.max(1,Math.ceil(vis.length/PAGE_SIZE));
  const pageRows=vis.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);

  // unmatched only from current page rows
  const pageUnmatched=pageRows.filter(r=>r.st!=="ok");
  const allUnmatched=vis.filter(r=>r.st!=="ok");

  const stC={ok:T.grn,warning:T.amb,missing:T.red};
  const stI={ok:"\u2713",warning:"\u26A0",missing:"\u2715"};

  const handleDropdownChange=(r,targetField)=>{
    const key=`${r.s}||${r.ch}`;
    setDropdownVals(prev=>({...prev,[key]:targetField}));
    setRows(prev=>prev.map(x=>x.s===r.s&&x.ch===r.ch?{...x,t:targetField,st:"ok"}:x));
    setPendingMappings(prev=>{
      const filtered=prev.filter(p=>!(p.source_column===r.s&&p.platform===r.ch));
      return[...filtered,{source_column:r.s,target_field:targetField,platform:r.ch}];
    });
  };

  const handleApplyMappings=async()=>{
    if(!pendingMappings.length)return;
    setSaving(true);
    try{
      await fetch(`${API_BASE.replace("/ingest","")}/mapping/apply`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({mappings:pendingMappings}),
      });
      setPendingMappings([]);
      setDropdownVals({});
      await fetchMappings();
    }catch(e){}finally{setSaving(false);}
  };

  return(
    <div style={{display:"flex",gap:0,height:"100%",minHeight:0}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:16,minWidth:0,overflow:"hidden"}}>
        <header>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <h2 style={{fontSize:21,fontWeight:750,color:T.navy,margin:0}}>Column Mapping</h2>
            {loading&&<span style={{fontSize:11,color:T.s400,fontWeight:600}}>Loading...</span>}
            {!loading&&<button onClick={fetchMappings} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${T.s200}`,background:"transparent",fontSize:11,color:T.s400,cursor:"pointer"}}>↻ Refresh</button>}
          </div>
          <p style={{color:T.s500,fontSize:13,margin:"5px 0 0"}}>Map source columns to your unified schema. Use dropdowns to resolve conflicts.</p>
        </header>

        {/* Tab filter + action buttons */}
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          {tabs.map(t=>(
            <button key={t} onClick={()=>{setSrc(t);setPage(0);}} style={{padding:"5px 14px",borderRadius:7,fontSize:12,fontWeight:650,cursor:"pointer",background:src===t?T.navy:T.s100,color:src===t?T.wh:T.s500,border:"none",transition:"all .15s"}}>{t}</button>
          ))}
          <div style={{flex:1}}/>
          {pendingMappings.length>0&&(
            <button onClick={handleApplyMappings} disabled={saving} style={{padding:"5px 14px",borderRadius:7,fontSize:12,fontWeight:650,cursor:"pointer",background:T.blue,color:T.wh,border:"none",opacity:saving?.7:1}}>
              {saving?"Saving...":"✓ Apply "+pendingMappings.length+" Changes"}
            </button>
          )}
          {pageUnmatched.length>0&&(
            <button onClick={()=>setHitl(true)} style={{padding:"5px 14px",borderRadius:7,fontSize:12,fontWeight:650,cursor:"pointer",background:T.ambP,color:T.amb,border:`1px solid ${T.ambB}`}}>
              ⚠ {pageUnmatched.length} on this page — Resolve
            </button>
          )}
        </div>

        {/* Table — fixed row height so 10 rows always fit */}
        <div style={{background:T.wh,borderRadius:10,border:`1px solid ${T.s200}`,overflow:"hidden",flex:"none"}}>
          {/* Header */}
          <div style={{display:"grid",gridTemplateColumns:"1.2fr 32px 1.2fr 90px 72px",padding:"9px 20px",background:T.s50,borderBottom:`1px solid ${T.s200}`,fontSize:10.5,fontWeight:700,color:T.s400,textTransform:"uppercase",letterSpacing:".06em"}}>
            <span>Source Column</span><span/><span>Target Field</span><span>Source</span><span style={{textAlign:"center"}}>Status</span>
          </div>
          {loading?(
            <div style={{padding:"28px 20px",textAlign:"center",color:T.s400,fontSize:13}}>Loading column mappings...</div>
          ):vis.length===0?(
            <div style={{padding:"28px 20px",textAlign:"center",color:T.s400,fontSize:13}}>No mappings yet. Upload files on Screen 1 to populate.</div>
          ):(
            /* Render exactly PAGE_SIZE rows; pad with empty divs to keep height stable */
            <>
              {pageRows.map((r,i)=>(
                <MappingRow key={`${r.s}||${r.ch}`} r={r} stC={stC} stI={stI} T={T} setHitl={setHitl}/>
              ))}
              {Array.from({length:PAGE_SIZE-pageRows.length}).map((_,i)=>(
                <div key={`pad-${i}`} style={{height:44,borderBottom:`1px solid ${T.s100}`}}/>
              ))}
            </>
          )}
        </div>

        {/* Pagination */}
        {vis.length>PAGE_SIZE&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"2px 2px"}}>
            <span style={{fontSize:12,color:T.s400}}>
              Showing {page*PAGE_SIZE+1}–{Math.min((page+1)*PAGE_SIZE,vis.length)} of {vis.length}
            </span>
            <div style={{display:"flex",gap:5,alignItems:"center"}}>
              <button onClick={()=>setPage(p=>p-1)} disabled={page===0} style={{width:28,height:28,borderRadius:7,border:`1px solid ${T.s200}`,background:page===0?T.s100:T.wh,color:page===0?T.s300:T.navy,cursor:page===0?"not-allowed":"pointer",fontSize:15,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
              {Array.from({length:totalPages},(_,i)=>(
                <button key={i} onClick={()=>setPage(i)} style={{width:28,height:28,borderRadius:7,border:`1px solid ${i===page?T.blue:T.s200}`,background:i===page?T.blue:T.wh,color:i===page?T.wh:T.navy,cursor:"pointer",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{i+1}</button>
              ))}
              <button onClick={()=>setPage(p=>p+1)} disabled={page===totalPages-1} style={{width:28,height:28,borderRadius:7,border:`1px solid ${T.s200}`,background:page===totalPages-1?T.s100:T.wh,color:page===totalPages-1?T.s300:T.navy,cursor:page===totalPages-1?"not-allowed":"pointer",fontSize:15,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Resolve Conflicts sidebar ── */}
      <div style={{width:hitl?310:0,marginLeft:hitl?16:0,transition:"all .3s ease",overflow:"hidden",flexShrink:0}}>
        {hitl&&(
          <div style={{width:310,background:T.wh,borderRadius:10,border:`1px solid ${T.s200}`,padding:20,display:"flex",flexDirection:"column",gap:14,height:"100%",boxSizing:"border-box",boxShadow:"-2px 0 16px rgba(0,0,0,.04)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <h3 style={{margin:0,fontSize:14,fontWeight:750,color:T.navy}}>Resolve Conflicts</h3>
              <XBtn onClick={()=>setHitl(false)}/>
            </div>
            <p style={{fontSize:12,color:T.s500,margin:0,lineHeight:1.5}}>
              Assign a target field for each unmatched column on this page ({page*PAGE_SIZE+1}–{Math.min((page+1)*PAGE_SIZE,vis.length)}).
            </p>

            <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
              {pageUnmatched.length===0?(
                <div style={{fontSize:13,color:T.grn,padding:"12px 0",fontWeight:600}}>✓ All columns on this page are resolved!</div>
              ):(
                pageUnmatched.map((r,i)=>{
                  const key=`${r.s}||${r.ch}`;
                  const val=dropdownVals[key]||"";
                  return(
                    <div key={i} style={{background:T.s50,borderRadius:8,padding:"10px 12px",border:`1px solid ${T.s200}`}}>
                      <div style={{fontSize:11,color:T.s400,marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:".04em"}}>{r.ch}</div>
                      <code style={{fontFamily:T.m,fontSize:12.5,color:T.navy,fontWeight:600,display:"block",marginBottom:8}}>{r.s}</code>
                      <select
                        value={val}
                        onChange={e=>handleDropdownChange(r,e.target.value)}
                        style={{width:"100%",padding:"7px 10px",borderRadius:6,border:`1px solid ${val?T.blue:T.s300}`,fontSize:12,color:val?T.navy:T.s400,background:T.wh,cursor:"pointer",outline:"none",fontFamily:T.m}}
                      >
                        <option value="">— select target field —</option>
                        {targets.map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  );
                })
              )}
            </div>

            {allUnmatched.length>0&&(
              <div style={{fontSize:11,color:T.s400,textAlign:"center",paddingTop:4}}>
                {allUnmatched.length} unmatched total across all pages
              </div>
            )}

            <button
              onClick={async()=>{await handleApplyMappings();setHitl(false);}}
              disabled={saving||!pendingMappings.length}
              style={{width:"100%",padding:"10px 0",background:pendingMappings.length?T.blue:T.s200,color:pendingMappings.length?T.wh:T.s400,border:"none",borderRadius:8,fontWeight:700,cursor:pendingMappings.length?"pointer":"not-allowed",fontSize:13,transition:"all .2s"}}
            >
              {saving?"Saving...":`Save Mappings${pendingMappings.length?" ("+pendingMappings.length+")":""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ===== SCREEN 3: STANDARDIZATION ===== */

const FIELD_TABS = [
  { id:"product_name", label:"Product Name" },
  { id:"category",     label:"Category" },
  { id:"sub_category", label:"Sub Category" },
  { id:"brand",        label:"Brand" },
];

function ProductStandardization({ apiKey, uploadedFiles, refreshKey }){
  const STD_BASE=`${API_BASE.replace("/ingest","")}/standardize`;

  // ── which field tab is active ──────────────────────────────────────────────
  const[fieldType,setFieldType]=useState("product_name");
  const isProduct = fieldType==="product_name";

  const[rev,setRev]=useState(false);
  const[edit,setEdit]=useState(null);
  const[editVal,setEditVal]=useState("");
  const[suggestions,setSuggestions]=useState([]);
  const[sugLoading,setSugLoading]=useState(false);
  const[sugError,setSugError]=useState("");
  const[data,setData]=useState([]);
  const[stats,setStats]=useState({total:0,high_confidence:0,medium_confidence:0,low_confidence:0});
  const[loading,setLoading]=useState(true);
  const[running,setRunning]=useState(false);
  const[saving,setSaving]=useState(false);

  // ── Group raw rows by unique standardized output ──────────────────────────
  // Returns one entry per unique standardized_name / standardized_value.
  // Each entry carries: ids[], o (first variant / canonical), a (standardized),
  // n (total occurrences), c (max confidence), st, ch, variants[]
  const groupByStandardized=useCallback((rawRows,isProductTab)=>{
    const map={};
    for(const d of (rawRows||[])){
      const val=(isProductTab?d.standardized_name:d.standardized_value)||"";
      const key=val.trim().toLowerCase();
      if(!key)continue;
      if(!map[key]){
        map[key]={
          ids:[],
          o: val,      // show the canonical standardized value as identifier
          a: val,
          c: d.confidence||0,
          ch: d.platform||"",
          st: d.status||"auto",
          n: 0,
          variants:[], // original raw values that collapsed to this canonical
        };
      }
      const g=map[key];
      g.ids.push(d.id);
      g.n+=(isProductTab?d.occurrence_count:d.occurrence_count)||1;
      const rawVal=isProductTab?d.original_name:d.original_value;
      if(rawVal&&!g.variants.includes(rawVal))g.variants.push(rawVal);
      if(d.status==="overridden")g.st="overridden";
      if((d.confidence||0)>g.c)g.c=d.confidence||0;
    }
    return Object.values(map).sort((a,b)=>{
      const aEdited=a.st==="overridden"?1:0;
      const bEdited=b.st==="overridden"?1:0;
      if(aEdited!==bEdited)return aEdited-bEdited; // unedited first
      return b.n-a.n; // then by occurrences descending within each group
    });
  },[]);

  // ── fetch rows + stats for the active tab ─────────────────────────────────
  const fetchData=useCallback(async()=>{
    const isProductTab = fieldType==="product_name";
    setLoading(true);
    try{
      if(isProductTab){
        const[prodRes,statsRes]=await Promise.all([
          fetch(`${STD_BASE}/products`),
          fetch(`${STD_BASE}/stats`),
        ]);
        const prodData=await prodRes.json();
        const statsData=await statsRes.json();
        setData(groupByStandardized(prodData||[],true));
        setStats(statsData||{total:0,high_confidence:0,medium_confidence:0,low_confidence:0});
      } else {
        let[fldRes,statsRes]=await Promise.all([
          fetch(`${STD_BASE}/fields?field_type=${fieldType}`),
          fetch(`${STD_BASE}/stats-fields?field_type=${fieldType}`),
        ]);
        let fldData=await fldRes.json();
        let statsData=await statsRes.json();
        // Auto-run standardization on first visit to this tab if no data exists yet
        if((fldData||[]).length===0){
          await fetch(`${STD_BASE}/run-fields?field_type=${fieldType}`,{method:"POST"});
          [fldRes,statsRes]=await Promise.all([
            fetch(`${STD_BASE}/fields?field_type=${fieldType}`),
            fetch(`${STD_BASE}/stats-fields?field_type=${fieldType}`),
          ]);
          fldData=await fldRes.json();
          statsData=await statsRes.json();
        }
        setData(groupByStandardized(fldData||[],false));
        setStats(statsData||{total:0,high_confidence:0,medium_confidence:0,low_confidence:0});
      }
    }catch(e){}finally{setLoading(false);}
  },[STD_BASE,fieldType,groupByStandardized]);

  useEffect(()=>{fetchData();},[fetchData]);

  // Reset UI state when tab changes (data will be repopulated by fetchData above)
  useEffect(()=>{
    setRev(false);
    setEdit(null);
  },[fieldType]);

  useEffect(()=>{
    if(refreshKey>0) fetchData();
  },[refreshKey,fetchData]);

  // ── AI + synonym suggestions (product name only) ──────────────────────────
  useEffect(()=>{
    if(!edit||fieldType!=="product_name")return;
    setSuggestions([]);
    setSugError("");
    setSugLoading(true);

    // Use the first raw original name variant for AI/synonym lookup — it carries
    // more contextual detail than the already-standardized canonical form.
    const queryName = (edit.variants&&edit.variants.length>0) ? edit.variants[0] : edit.o;

    const synPromise = fetch(`${STD_BASE}/suggest-synonym`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({product_name:queryName, platform:edit.ch}),
    }).then(r=>r.ok?r.json():null).catch(()=>null);

    const aiPromise = apiKey
      ? fetch(`${STD_BASE}/suggest`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({product_name:queryName, api_key:apiKey, provider:"groq", platform:edit.ch}),
        }).then(async r=>{
          if(!r.ok){
            const err=await r.json().catch(()=>({detail:`HTTP ${r.status}`}));
            throw new Error(err.detail||`HTTP ${r.status}`);
          }
          return r.json();
        }).catch(e=>{setSugError(`AI suggestion failed: ${e.message}`);return null;})
      : Promise.resolve(null);

    Promise.all([synPromise, aiPromise]).then(([synResult, aiResult])=>{
      const allSugs = [];
      const synData = synResult || (aiResult && aiResult.synonym_suggestion);
      if(synData && synData.standardized_name && synData.confidence > 0){
        allSugs.push({name:synData.standardized_name,confidence:synData.confidence,taxonomy:synData.taxonomy||null,source:"synonym"});
      }
      if(aiResult){
        allSugs.push({name:aiResult.standardized_name,confidence:aiResult.confidence,taxonomy:aiResult.taxonomy||null,source:"ai"});
      }
      allSugs.push({name:edit.a,confidence:edit.c,source:"rule"});
      const seen=new Set();
      setSuggestions(allSugs.filter(s=>{const k=s.name.trim().toLowerCase();if(seen.has(k))return false;seen.add(k);return true;}));
    }).finally(()=>setSugLoading(false));
  },[edit,fieldType]);

  // ── non-product: fetch synonym suggestions for brand/category/sub_category ─
  useEffect(()=>{
    if(!edit||fieldType==="product_name")return;
    setSuggestions([]);
    setSugError("");
    setSugLoading(true);

    // Query using each raw variant to get the richest synonym matches.
    // Deduplicate results across all variant queries.
    const queryVals=edit.variants&&edit.variants.length>0
      ? edit.variants.slice(0,4)   // up to 4 variants
      : [edit.o];

    Promise.all(
      queryVals.map(val=>
        fetch(`${STD_BASE}/suggest-field`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({value:val,field_type:fieldType}),
        }).then(r=>r.ok?r.json():null).catch(()=>null)
      )
    ).then(results=>{
      const seen=new Set();
      const allSugs=[];
      for(const res of results){
        for(const s of (res?.suggestions||[])){
          const k=(s.name||"").trim().toLowerCase();
          if(k&&!seen.has(k)){seen.add(k);allSugs.push(s);}
        }
      }
      // Always include the current canonical as a fallback chip
      const curKey=edit.a.trim().toLowerCase();
      if(!seen.has(curKey))
        allSugs.push({name:edit.a,confidence:edit.c,source:"rule"});
      setSuggestions(allSugs);
    }).finally(()=>setSugLoading(false));
  },[edit,fieldType,STD_BASE]);

  // ── actions ────────────────────────────────────────────────────────────────
  const handleRun=async()=>{
    setRunning(true);
    try{
      if(fieldType==="product_name"){
        await fetch(`${STD_BASE}/run`,{method:"POST"});
      } else {
        await fetch(`${STD_BASE}/run-fields?field_type=${fieldType}`,{method:"POST"});
      }
      await fetchData();
    }catch(e){}finally{setRunning(false);}
  };

  const openEdit=(d)=>{
    setEdit(d);
    setEditVal(d.a);
    setSuggestions([]);
    setSugError("");
  };

  const handleSaveOverride=async()=>{
    if(!edit||!editVal.trim())return;
    setSaving(true);
    setSugError("");
    try{
      // Use batch endpoints — one call updates every original_name variant that
      // maps to the same standardized output (the group).
      let res;
      if(fieldType==="product_name"){
        res=await fetch(`${STD_BASE}/override-batch`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ids:edit.ids,standardized_name:editVal.trim()}),
        });
      } else {
        res=await fetch(`${STD_BASE}/override-field-batch`,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ids:edit.ids,standardized_value:editVal.trim()}),
        });
      }
      if(!res.ok){
        const err=await res.json().catch(()=>({}));
        setSugError(err.detail||`Save failed (${res.status})`);
        return;
      }
      // Update the row in local state by matching old canonical value (edit.a)
      const oldVal=edit.a;
      const newVal=editVal.trim();
      setData(prev=>prev.map(d=>
        d.a===oldVal ? {...d,o:newVal,a:newVal,c:100,st:"overridden"} : d
      ));
      setStats(prev=>({
        ...prev,
        high_confidence:prev.high_confidence+(edit.c<90?1:0),
        medium_confidence:prev.medium_confidence-(edit.c>=70&&edit.c<90?1:0),
        low_confidence:prev.low_confidence-(edit.c<70?1:0),
      }));
      setEdit(null);
    }catch(e){
      setSugError("Network error — could not save.");
    }finally{setSaving(false);}
  };

  const vis=rev?data.filter(d=>d.c<80):data;
  const activeTab=FIELD_TABS.find(t=>t.id===fieldType);
  const colLabel=activeTab?.label||"Value";

  return(
    <div style={{display:"flex",flexDirection:"column",gap:22}}>
      <header>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <h2 style={{fontSize:21,fontWeight:750,color:T.navy,margin:0}}>Standardization Engine</h2>
          {loading&&<span style={{fontSize:11,color:T.s400,fontWeight:600}}>Loading...</span>}
        </div>
        <p style={{color:T.s500,fontSize:13,margin:"5px 0 0"}}>Synonym-based + AI-powered normalization across all channels.</p>
      </header>

      {/* ── Field type tabs ── */}
      <div style={{display:"flex",gap:6,background:T.s50,padding:6,borderRadius:10,border:`1px solid ${T.s200}`,width:"fit-content"}}>
        {FIELD_TABS.map(tab=>(
          <button
            key={tab.id}
            onClick={()=>setFieldType(tab.id)}
            style={{
              padding:"7px 18px",borderRadius:7,fontSize:12,fontWeight:650,cursor:"pointer",
              border:"none",
              background:fieldType===tab.id?T.navy:"transparent",
              color:fieldType===tab.id?T.wh:T.s500,
              transition:"all .15s",
            }}
          >{tab.label}</button>
        ))}
      </div>

      {/* No API key notice (product name only) */}
      {isProduct&&!apiKey&&(
        <div style={{background:"#FFFBEB",border:`1px solid ${T.ambB}`,borderRadius:10,padding:"11px 16px",display:"flex",alignItems:"center",gap:10,fontSize:13,color:"#92400E"}}>
          <span>⚠</span>
          <span>No API key set — synonym-based standardization and <strong>📖 Synonym suggestions</strong> are active. Add a Groq key in <strong>Settings</strong> to also enable AI-powered suggestions inside the edit popup.</span>
        </div>
      )}

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        {[
          {l:"Total Processed",v:stats.total,cl:T.navy},
          {l:"High Confidence ≥90%",v:stats.high_confidence,cl:T.grn},
          {l:"Medium 70–89%",v:stats.medium_confidence,cl:T.amb},
          {l:"Needs Review <70%",v:stats.low_confidence,cl:T.red},
        ].map(s=>(
          <div key={s.l} style={{background:T.wh,borderRadius:10,padding:"16px 20px",border:`1px solid ${T.s200}`,boxShadow:"0 1px 3px rgba(11,18,34,.06)"}}>
            <div style={{fontSize:10.5,color:T.s400,fontWeight:650,textTransform:"uppercase",letterSpacing:".04em",marginBottom:4}}>{s.l}</div>
            <div style={{fontSize:26,fontWeight:800,color:s.cl}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filter + actions */}
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button onClick={()=>setRev(false)} style={{padding:"6px 16px",borderRadius:7,fontSize:12,fontWeight:650,cursor:"pointer",background:!rev?T.navy:T.s100,color:!rev?T.wh:T.s500,border:"none"}}>All {colLabel}s</button>
        <button onClick={()=>setRev(true)} style={{padding:"6px 16px",borderRadius:7,fontSize:12,fontWeight:650,cursor:"pointer",background:rev?T.red:T.s100,color:rev?T.wh:T.s500,border:"none"}}>⚑ Needs Review</button>
        <div style={{flex:1}}/>
        <button onClick={handleRun} disabled={running} style={{padding:"6px 16px",borderRadius:7,fontSize:12,fontWeight:650,cursor:running?"not-allowed":"pointer",background:T.blueG,color:T.blue,border:`1px solid ${T.blue}40`,opacity:running?.7:1}}>
          {running?"Running...":"⚡ Re-run Standardization"}
        </button>
        <button onClick={fetchData} style={{padding:"6px 12px",borderRadius:7,fontSize:12,fontWeight:650,cursor:"pointer",background:T.s100,color:T.s500,border:"none"}}>↻ Refresh</button>
      </div>

      {/* Table */}
      <div style={{background:T.wh,borderRadius:10,border:`1px solid ${T.s200}`,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"1.6fr 1.4fr 70px 90px 100px 70px",padding:"11px 20px",background:T.s50,borderBottom:`1px solid ${T.s200}`,fontSize:10.5,fontWeight:700,color:T.s400,textTransform:"uppercase",letterSpacing:".06em"}}>
          <span>Canonical {colLabel}</span>
          <span>Standardized Output</span>
          <span>Source</span>
          <span style={{textAlign:"center"}}>Occurrences</span>
          <span style={{textAlign:"center"}}>Confidence</span>
          <span style={{textAlign:"center"}}>Action</span>
        </div>
        {loading?(
          <div style={{padding:"40px 20px",textAlign:"center",color:T.s400,fontSize:13}}>Loading standardized {colLabel.toLowerCase()}s...</div>
        ):vis.length===0?(
          <div style={{padding:"40px 20px",textAlign:"center",color:T.s400,fontSize:13}}>
            {data.length===0?`No data yet. Upload files and click ⚡ Re-run Standardization.`:`No ${colLabel.toLowerCase()}s need review.`}
          </div>
        ):(
          vis.map((d,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"1.6fr 1.4fr 70px 90px 100px 70px",padding:"13px 20px",borderBottom:`1px solid ${T.s100}`,alignItems:"center",background:d.c<70?T.redP+"20":"transparent"}}>
              {/* Col 1: canonical / original name + variant hint */}
              <div style={{paddingRight:12}}>
                <span style={{fontSize:12.5,color:T.s600||T.s500,lineHeight:1.45}}>{d.o}</span>
                {d.variants&&d.variants.length>1&&(
                  <div style={{fontSize:10.5,color:T.s400,marginTop:2}}>{d.variants.length} source variants</div>
                )}
              </div>
              {/* Col 2: standardized output */}
              <span style={{fontSize:12.5,color:T.navy,fontWeight:550,lineHeight:1.45,paddingRight:12}}>
                {d.a}
                {d.st==="overridden"&&<span style={{marginLeft:6,fontSize:10,color:T.grn,fontWeight:700,background:T.grnP,padding:"1px 5px",borderRadius:4}}>edited</span>}
              </span>
              {/* Col 3: platform source */}
              <Pill>{d.ch}</Pill>
              {/* Col 4: total occurrences */}
              <div style={{textAlign:"center",fontSize:12.5,fontWeight:600,color:T.navy}}>{d.n}</div>
              {/* Col 5: confidence bar */}
              <div style={{padding:"0 4px"}}><ConfBar value={d.c}/></div>
              {/* Col 6: action — always show Edit for every row */}
              <div style={{textAlign:"center"}}>
                <button onClick={()=>openEdit(d)} style={{padding:"4px 12px",background:"#FFF7ED",color:"#C2410C",border:"1px solid #FED7AA",borderRadius:6,fontSize:11,fontWeight:650,cursor:"pointer"}}>Edit</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Edit / Override modal ── */}
      {edit!==null&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,18,34,.45)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setEdit(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:T.wh,borderRadius:16,padding:"28px 30px",width:520,boxShadow:"0 12px 40px rgba(11,18,34,.14)",maxHeight:"90vh",overflowY:"auto"}}>

            {/* Modal header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h3 style={{margin:0,fontSize:16,fontWeight:750,color:T.navy}}>Edit Standardized {colLabel}</h3>
              <XBtn onClick={()=>setEdit(null)}/>
            </div>

            {/* Current canonical value */}
            <label style={{display:"block",fontSize:12,fontWeight:650,color:T.s400,marginBottom:6}}>Current Canonical {colLabel}</label>
            <div style={{padding:"10px 14px",background:T.s50,borderRadius:8,fontSize:13,color:T.s500,marginBottom:edit.variants&&edit.variants.length>1?8:18,border:`1px solid ${T.s200}`,fontFamily:T.m}}>{edit.o}</div>

            {/* Source variants (collapsed list) */}
            {edit.variants&&edit.variants.length>1&&(
              <div style={{marginBottom:18}}>
                <div style={{fontSize:11,fontWeight:650,color:T.s400,marginBottom:4}}>
                  ↳ {edit.variants.length} source variants — edit will apply to all
                </div>
                <div style={{maxHeight:80,overflowY:"auto",padding:"6px 10px",background:T.s50,borderRadius:6,border:`1px solid ${T.s200}`}}>
                  {edit.variants.map((v,i)=>(
                    <div key={i} style={{fontSize:11,color:T.s400,padding:"1px 0",fontFamily:T.m,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{v}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions section */}
            <div style={{marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:12,fontWeight:700,color:T.s400,textTransform:"uppercase",letterSpacing:".06em"}}>
                  {isProduct?(apiKey?"✦ AI + Synonym Suggestions":"📖 Synonym Suggestions"):"📖 Synonym Suggestions"}
                </span>
                {sugLoading&&<span style={{fontSize:11,color:T.blue}}>fetching...</span>}
                {isProduct&&!apiKey&&<span style={{fontSize:11,color:T.s400}}>(add API key in Settings for AI suggestions too)</span>}
                {!isProduct&&<span style={{fontSize:11,color:T.s400}}>(from synonym config vocabulary)</span>}
              </div>

              {sugError&&(
                <div style={{fontSize:12,color:T.amb,background:T.ambP,padding:"8px 12px",borderRadius:7,marginBottom:8}}>{sugError}</div>
              )}

              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {sugLoading&&[1,2,3].map(i=>(
                  <div key={i} style={{height:42,borderRadius:8,background:T.s100,animation:"pulse 1.2s ease infinite"}}/>
                ))}
                {!sugLoading&&suggestions.map((s,i)=>{
                  const isSelected=editVal===s.name;
                  const isAI=s.source==="ai";
                  const isSyn=s.source==="synonym";
                  const accentColor=isSyn?"#7C3AED":isAI?T.blue:T.s300;
                  const accentBg=isSyn?"#F5F3FF":isAI?T.blueG:T.s50;
                  return(
                    <div
                      key={i}
                      onClick={()=>setEditVal(s.name)}
                      style={{
                        padding:"10px 14px",borderRadius:8,cursor:"pointer",
                        border:`1.5px solid ${isSelected?accentColor:T.s200}`,
                        background:isSelected?accentBg:T.wh,
                        transition:"all .15s",display:"flex",justifyContent:"space-between",alignItems:"center",
                      }}
                    >
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:T.navy}}>{s.name}</div>
                        {(isAI||isSyn)&&s.taxonomy&&(
                          <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                            {[
                              s.taxonomy.brand&&`Brand: ${s.taxonomy.brand}`,
                              s.taxonomy.main_category&&`Cat: ${s.taxonomy.main_category}`,
                              s.taxonomy.sub_type&&`Type: ${s.taxonomy.sub_type}`,
                              (s.taxonomy.size!=null&&s.taxonomy.unit)&&`${s.taxonomy.size}${s.taxonomy.unit}`,
                              s.taxonomy.container&&`${s.taxonomy.container}`,
                            ].filter(Boolean).map((tag,j)=>(
                              <span key={j} style={{fontSize:10.5,color:isSyn?"#6D28D9":T.s400,background:isSyn?"#EDE9FE":T.s100,padding:"1px 6px",borderRadius:4}}>{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0,marginLeft:12}}>
                        {isSyn&&<span style={{fontSize:10,fontWeight:700,color:"#7C3AED",background:"#EDE9FE",padding:"2px 7px",borderRadius:10}}>📖 Synonym</span>}
                        {isAI&&<span style={{fontSize:10,fontWeight:700,color:T.blue,background:T.blueP,padding:"2px 7px",borderRadius:10}}>✦ AI</span>}
                        {!isAI&&!isSyn&&<span style={{fontSize:10,fontWeight:700,color:T.s400,background:T.s100,padding:"2px 7px",borderRadius:10}}>Rule-based</span>}
                        <span style={{fontSize:10.5,fontWeight:700,color:s.confidence>=80?T.grn:T.amb}}>{s.confidence}%</span>
                        {isSelected&&<span style={{fontSize:10,color:isSyn?"#7C3AED":isAI?T.blue:T.s400}}>● selected</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Manual input */}
            <label style={{display:"block",fontSize:12,fontWeight:650,color:T.s400,marginBottom:6}}>Standardized {colLabel} <span style={{fontWeight:400}}>(edit freely or click a suggestion above)</span></label>
            <input
              value={editVal}
              onChange={e=>setEditVal(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleSaveOverride()}
              style={{width:"100%",padding:"10px 14px",border:`1px solid ${T.s200}`,borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:T.f}}
              onFocus={e=>e.target.style.borderColor=T.blue}
              onBlur={e=>e.target.style.borderColor=T.s200}
            />

            {/* Footer buttons */}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20}}>
              <button onClick={()=>setEdit(null)} style={{padding:"10px 22px",background:T.s100,color:T.s500,border:"none",borderRadius:8,fontWeight:650,cursor:"pointer",fontSize:13}}>Cancel</button>
              <button
                onClick={handleSaveOverride}
                disabled={saving||!editVal.trim()}
                style={{padding:"10px 26px",background:T.grn,color:T.wh,border:"none",borderRadius:8,fontWeight:650,cursor:(saving||!editVal.trim())?"not-allowed":"pointer",fontSize:13,opacity:(saving||!editVal.trim())?.6:1}}
              >
                {saving?"Saving...":"✓ Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// function ProductStandardization(){
//   const STD_BASE=`${API_BASE.replace("/ingest","")}/standardize`;
//   const[rev,setRev]=useState(false);
//   const[edit,setEdit]=useState(null);  // {id, o, a}
//   const[editVal,setEditVal]=useState("");
//   const[data,setData]=useState([]);
//   const[stats,setStats]=useState({total:0,high_confidence:0,medium_confidence:0,low_confidence:0});
//   const[loading,setLoading]=useState(true);
//   const[running,setRunning]=useState(false);
//   const[saving,setSaving]=useState(false);

//   const fetchData=useCallback(async()=>{
//     setLoading(true);
//     try{
//       const[prodRes,statsRes]=await Promise.all([
//         fetch(`${STD_BASE}/products`),
//         fetch(`${STD_BASE}/stats`),
//       ]);
//       const prodData=await prodRes.json();
//       const statsData=await statsRes.json();
//       // Normalise to shape {id,o,a,c,ch}
//       setData((prodData||[]).map(p=>({id:p.id,o:p.original_name,a:p.standardized_name,c:p.confidence,ch:p.platform})));
//       setStats(statsData||{total:0,high_confidence:0,medium_confidence:0,low_confidence:0});
//     }catch(e){}finally{setLoading(false);}
//   },[STD_BASE]);

//   useEffect(()=>{fetchData();},[fetchData]);

//   const handleRun=async()=>{
//     setRunning(true);
//     try{
//       await fetch(`${STD_BASE}/run`,{method:"POST"});
//       await fetchData();
//     }catch(e){}finally{setRunning(false);}
//   };

//   const handleSaveOverride=async()=>{
//     if(!edit||!editVal.trim())return;
//     setSaving(true);
//     try{
//       await fetch(`${STD_BASE}/override/${edit.id}`,{
//         method:"POST",
//         headers:{"Content-Type":"application/json"},
//         body:JSON.stringify({standardized_name:editVal.trim()}),
//       });
//       // Optimistic update
//       setData(prev=>prev.map(d=>d.id===edit.id?{...d,a:editVal.trim(),c:100}:d));
//       setStats(prev=>({...prev,high_confidence:prev.high_confidence+(edit.c<90?1:0),low_confidence:prev.low_confidence-(edit.c<70?1:0),medium_confidence:prev.medium_confidence-(edit.c>=70&&edit.c<90?1:0)}));
//       setEdit(null);
//     }catch(e){}finally{setSaving(false);}
//   };

//   const vis=rev?data.filter(d=>d.c<80):data;

//   return(
//     <div style={{display:"flex",flexDirection:"column",gap:22}}>
//       <header>
//         <div style={{display:"flex",alignItems:"center",gap:12}}>
//           <h2 style={{fontSize:21,fontWeight:750,color:T.navy,margin:0}}>Product Standardization Engine</h2>
//           {loading&&<span style={{fontSize:11,color:T.s400,fontWeight:600}}>Loading...</span>}
//         </div>
//         <p style={{color:T.s500,fontSize:13,margin:"5px 0 0"}}>AI-powered normalization of product names across all channels.</p>
//       </header>
//       <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
//         {[
//           {l:"Total Processed",v:stats.total,cl:T.navy},
//           {l:"High Confidence ≥90%",v:stats.high_confidence,cl:T.grn},
//           {l:"Medium 70–89%",v:stats.medium_confidence,cl:T.amb},
//           {l:"Needs Review <70%",v:stats.low_confidence,cl:T.red}
//         ].map(s=>(
//           <div key={s.l} style={{background:T.wh,borderRadius:10,padding:"16px 20px",border:`1px solid ${T.s200}`,boxShadow:"0 1px 3px rgba(11,18,34,.06)"}}>
//             <div style={{fontSize:10.5,color:T.s400,fontWeight:650,textTransform:"uppercase",letterSpacing:".04em",marginBottom:4}}>{s.l}</div>
//             <div style={{fontSize:26,fontWeight:800,color:s.cl}}>{s.v}</div>
//           </div>
//         ))}
//       </div>
//       <div style={{display:"flex",gap:8,alignItems:"center"}}>
//         <button onClick={()=>setRev(false)} style={{padding:"6px 16px",borderRadius:7,fontSize:12,fontWeight:650,cursor:"pointer",background:!rev?T.navy:T.s100,color:!rev?T.wh:T.s500,border:"none"}}>All Products</button>
//         <button onClick={()=>setRev(true)} style={{padding:"6px 16px",borderRadius:7,fontSize:12,fontWeight:650,cursor:"pointer",background:rev?T.red:T.s100,color:rev?T.wh:T.s500,border:"none"}}>{"\u2691"} Needs Review</button>
//         <div style={{flex:1}}/>
//         <button onClick={handleRun} disabled={running} style={{padding:"6px 16px",borderRadius:7,fontSize:12,fontWeight:650,cursor:running?"not-allowed":"pointer",background:T.blueG,color:T.blue,border:`1px solid ${T.blue}40`,opacity:running?.7:1}}>
//           {running?"Running...":"⚡ Re-run Standardization"}
//         </button>
//         <button onClick={fetchData} style={{padding:"6px 12px",borderRadius:7,fontSize:12,fontWeight:650,cursor:"pointer",background:T.s100,color:T.s500,border:"none"}}>↻ Refresh</button>
//       </div>
//       <div style={{background:T.wh,borderRadius:10,border:`1px solid ${T.s200}`,overflow:"hidden"}}>
//         <div style={{display:"grid",gridTemplateColumns:"1.1fr 1.1fr 78px 150px 70px",padding:"11px 20px",background:T.s50,borderBottom:`1px solid ${T.s200}`,fontSize:10.5,fontWeight:700,color:T.s400,textTransform:"uppercase",letterSpacing:".06em"}}>
//           <span>Original Product Name</span><span>Standardized AI Output</span><span>Source</span><span style={{textAlign:"center"}}>Confidence</span><span style={{textAlign:"center"}}>Action</span>
//         </div>
//         {loading?(
//           <div style={{padding:"40px 20px",textAlign:"center",color:T.s400,fontSize:13}}>Loading standardized products...</div>
//         ):vis.length===0?(
//           <div style={{padding:"40px 20px",textAlign:"center",color:T.s400,fontSize:13}}>
//             {data.length===0?"No data yet. Upload files and click ⚡ Re-run Standardization.":"No products need review."}
//           </div>
//         ):(
//           vis.map((d,i)=>(
//             <div key={d.id||i} style={{display:"grid",gridTemplateColumns:"1.1fr 1.1fr 78px 150px 70px",padding:"13px 20px",borderBottom:`1px solid ${T.s100}`,alignItems:"center",background:d.c<70?T.redP+"20":"transparent"}}>
//               <span style={{fontSize:12.5,color:T.s500,lineHeight:1.45,paddingRight:12}}>{d.o}</span>
//               <span style={{fontSize:12.5,color:T.navy,fontWeight:550,lineHeight:1.45,paddingRight:12}}>{d.a}</span>
//               <Pill>{d.ch}</Pill>
//               <div style={{padding:"0 8px"}}><ConfBar value={d.c}/></div>
//               <div style={{textAlign:"center"}}>{d.c<80?<button onClick={()=>{setEdit(d);setEditVal(d.a);}} style={{padding:"4px 12px",background:"#FFF7ED",color:"#C2410C",border:"1px solid #FED7AA",borderRadius:6,fontSize:11,fontWeight:650,cursor:"pointer"}}>Edit</button>:<span style={{color:T.grn,fontSize:15}}>{"\u2713"}</span>}</div>
//             </div>
//           ))
//         )}
//       </div>
//       {edit!==null&&(
//         <div style={{position:"fixed",inset:0,background:"rgba(11,18,34,.45)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setEdit(null)}>
//           <div onClick={e=>e.stopPropagation()} style={{background:T.wh,borderRadius:16,padding:"28px 30px",width:480,boxShadow:"0 12px 40px rgba(11,18,34,.12)"}}>
//             <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
//               <h3 style={{margin:0,fontSize:16,fontWeight:750,color:T.navy}}>Manual Override</h3>
//               <XBtn onClick={()=>setEdit(null)}/>
//             </div>
//             <label style={{display:"block",fontSize:12,fontWeight:650,color:T.s400,marginBottom:6}}>Original</label>
//             <div style={{padding:"10px 14px",background:T.s50,borderRadius:8,fontSize:13,color:T.s500,marginBottom:16,border:`1px solid ${T.s200}`}}>{edit?.o}</div>
//             <label style={{display:"block",fontSize:12,fontWeight:650,color:T.s400,marginBottom:6}}>Standardized Name</label>
//             <input value={editVal} onChange={e=>setEditVal(e.target.value)} style={{width:"100%",padding:"10px 14px",border:`1px solid ${T.s200}`,borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:T.f}} onFocus={e=>e.target.style.borderColor=T.blue} onBlur={e=>e.target.style.borderColor=T.s200}/>
//             <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20}}>
//               <button onClick={()=>setEdit(null)} style={{padding:"10px 22px",background:T.s100,color:T.s500,border:"none",borderRadius:8,fontWeight:650,cursor:"pointer",fontSize:13}}>Cancel</button>
//               <button onClick={handleSaveOverride} disabled={saving} style={{padding:"10px 26px",background:T.grn,color:T.wh,border:"none",borderRadius:8,fontWeight:650,cursor:"pointer",fontSize:13,opacity:saving?.7:1}}>{saving?"Saving...":"Save Override"}</button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
 
// /* ===== SCREEN 4: ANALYTICS ===== */
// function AnalyticsDashboard(){
//   const [data, setData]       = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError]     = useState(null);

//   const CHANNEL_COLORS = [T.blue, T.grn, T.amb, "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

//   const fetchData = () => {
//     setLoading(true);
//     fetch("http://localhost:8000/api/analytics/summary")
//       .then(r => r.json())
//       .then(d => { setData(d); setLoading(false); })
//       .catch(e => { setError(e.message); setLoading(false); });
//   };

//   useEffect(() => { fetchData(); }, []);

//   const fmt = (n) => {
//     if (n === null || n === undefined) return "—";
//     if (n >= 1e7)  return "₹" + (n/1e7).toFixed(2) + "Cr";
//     if (n >= 1e5)  return "₹" + (n/1e5).toFixed(1) + "L";
//     if (n >= 1000) return "₹" + (n/1000).toFixed(1) + "K";
//     return "₹" + Number(n).toLocaleString("en-IN");
//   };

//   const fmtUnits = (n) => {
//     if (!n) return "0";
//     if (n >= 1e6) return (n/1e6).toFixed(1) + "M";
//     if (n >= 1000) return (n/1000).toFixed(1) + "K";
//     return Number(n).toLocaleString("en-IN");
//   };

//   const RevenueChart = ({ series }) => {
//     if (!series || series.length === 0) return (
//       <div style={{height:52,display:"flex",alignItems:"center",justifyContent:"center",color:T.s300,fontSize:12}}>No date data</div>
//     );
//     const vals = series.map(d => d.revenue);
//     const max  = Math.max(...vals) || 1;
//     const W = 200, H = 52;
//     const barW = Math.max(2, Math.floor(W / vals.length) - 1);
//     return (
//       <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{display:"block"}}>
//         {vals.map((v, i) => {
//           const h = Math.max(2, Math.round((v / max) * (H - 4)));
//           return <rect key={i} x={i*(barW+1)} y={H-h} width={barW} height={h} rx="2"
//             fill={i===vals.length-1 ? T.blue : T.blueP}/>;
//         })}
//       </svg>
//     );
//   };

//   const ChannelDonut = ({ contrib }) => {
//     const entries = Object.entries(contrib || {}).slice(0, 6);
//     if (!entries.length) return <div style={{color:T.s300,fontSize:12}}>No channel data</div>;
//     const CIRC = 2 * Math.PI * 36;
//     let cumPct = 0;
//     const slices = entries.map(([k, pct], i) => {
//       const dash   = (pct / 100) * CIRC;
//       const gap    = CIRC - dash;
//       const offset = -(cumPct / 100) * CIRC - (CIRC * 0.25);
//       cumPct += pct;
//       return { k, dash, gap, offset, color: CHANNEL_COLORS[i % CHANNEL_COLORS.length], pct };
//     });
//     return (
//       <div style={{display:"flex",alignItems:"center",gap:18}}>
//         <svg width="88" height="88" viewBox="0 0 100 100" style={{flexShrink:0}}>
//           <circle cx="50" cy="50" r="36" fill="none" stroke={T.s100} strokeWidth="13"/>
//           {slices.map(s => (
//             <circle key={s.k} cx="50" cy="50" r="36" fill="none" stroke={s.color}
//               strokeWidth="13" strokeDasharray={`${s.dash} ${s.gap}`}
//               strokeDashoffset={s.offset} strokeLinecap="round"/>
//           ))}
//         </svg>
//         <div style={{display:"flex",flexDirection:"column",gap:7}}>
//           {slices.map(s => (
//             <div key={s.k} style={{display:"flex",alignItems:"center",gap:7,fontSize:12}}>
//               <div style={{width:8,height:8,borderRadius:2,background:s.color,flexShrink:0}}/>
//               <span style={{color:T.s500}}>{s.k}</span>
//               <span style={{fontWeight:750,color:T.navy,marginLeft:"auto",paddingLeft:8}}>{s.pct}%</span>
//             </div>
//           ))}
//         </div>
//       </div>
//     );
//   };

//   if (loading) return (
//     <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300,flexDirection:"column",gap:12}}>
//       <div style={{width:32,height:32,borderRadius:"50%",border:`3px solid ${T.blueP}`,borderTopColor:T.blue,animation:"spin 0.8s linear infinite"}}/>
//       <span style={{color:T.s400,fontSize:13}}>Building unified dataset…</span>
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (error) return (
//     <div style={{padding:24,background:T.wh,borderRadius:10,border:`1px solid ${T.s200}`,color:T.red,fontSize:13}}>
//       Failed to load analytics: {error}
//     </div>
//   );

//   if (!data?.has_data) return (
//     <div style={{display:"flex",flexDirection:"column",gap:22}}>
//       <header><h2 style={{fontSize:21,fontWeight:750,color:T.navy,margin:0}}>Analytics Dashboard</h2></header>
//       <div style={{padding:"40px 24px",background:T.wh,borderRadius:10,border:`1px solid ${T.s200}`,textAlign:"center"}}>
//         <div style={{fontSize:36,marginBottom:12}}>📊</div>
//         <div style={{fontSize:15,fontWeight:650,color:T.navy,marginBottom:6}}>No data yet</div>
//         <div style={{fontSize:13,color:T.s400}}>{data?.message || "Upload files and map columns to see analytics."}</div>
//       </div>
//     </div>
//   );

//   const kpis     = data.kpis || {};
//   const topProds = kpis.top_products || [];
//   const revSeries= kpis.revenue_by_date || [];

//   return (
//     <div style={{display:"flex",flexDirection:"column",gap:22}}>

//       {/* Header */}
//       <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
//         <div>
//           <h2 style={{fontSize:21,fontWeight:750,color:T.navy,margin:0}}>Analytics Dashboard</h2>
//           <p style={{color:T.s500,fontSize:13,margin:"5px 0 0"}}>
//             Live data · {(kpis.platforms||[]).length} platform{(kpis.platforms||[]).length!==1?"s":""} · {(data.total_rows||0).toLocaleString("en-IN")} order lines
//           </p>
//         </div>
//         <button onClick={fetchData}
//           style={{padding:"8px 18px",background:T.s50,color:T.navy,border:`1px solid ${T.s200}`,
//             borderRadius:8,fontSize:12,fontWeight:650,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
//           ↻ Refresh
//         </button>
//       </div>

//       <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>

//         {/* Total Revenue */}
//         <div style={{background:T.wh,borderRadius:10,padding:20,border:`1px solid ${T.s200}`,boxShadow:"0 1px 3px rgba(11,18,34,.06)"}}>
//           <div style={{fontSize:10.5,fontWeight:700,color:T.s400,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Total Revenue (GMV)</div>
//           <div style={{fontSize:28,fontWeight:800,color:T.navy,marginBottom:12}}>{fmt(kpis.total_revenue)}</div>
//           <RevenueChart series={revSeries}/>
//         </div>

//         {/* Channel Contribution */}
//         <div style={{background:T.wh,borderRadius:10,padding:20,border:`1px solid ${T.s200}`,boxShadow:"0 1px 3px rgba(11,18,34,.06)"}}>
//           <div style={{fontSize:10.5,fontWeight:700,color:T.s400,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Channel Contribution</div>
//           <ChannelDonut contrib={kpis.channel_contribution}/>
//         </div>

//         {/* Units Sold */}
//         <div style={{background:T.wh,borderRadius:10,padding:20,border:`1px solid ${T.s200}`,boxShadow:"0 1px 3px rgba(11,18,34,.06)"}}>
//           <div style={{fontSize:10.5,fontWeight:700,color:T.s400,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Total Units Sold</div>
//           <div style={{fontSize:28,fontWeight:800,color:T.navy}}>{fmtUnits(kpis.total_units_sold)}</div>
//           <div style={{marginTop:8,fontSize:12,color:T.s400}}>{kpis.unique_skus || 0} unique SKUs</div>
//         </div>

//         {/* Avg Revenue per Unit */}
//         <div style={{background:T.wh,borderRadius:10,padding:20,border:`1px solid ${T.s200}`,boxShadow:"0 1px 3px rgba(11,18,34,.06)"}}>
//           <div style={{fontSize:10.5,fontWeight:700,color:T.s400,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Avg Revenue / Unit</div>
//           <div style={{fontSize:28,fontWeight:800,color:T.navy}}>{fmt(kpis.avg_order_value)}</div>
//         </div>

//         {/* Platforms */}
//         <div style={{background:T.wh,borderRadius:10,padding:20,border:`1px solid ${T.s200}`,boxShadow:"0 1px 3px rgba(11,18,34,.06)"}}>
//           <div style={{fontSize:10.5,fontWeight:700,color:T.s400,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Platforms</div>
//           <div style={{fontSize:28,fontWeight:800,color:T.navy,marginBottom:10}}>{(kpis.platforms||[]).length}</div>
//           <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
//             {(kpis.platforms||[]).map(p=>(
//               <span key={p} style={{padding:"2px 8px",background:T.blueG,borderRadius:4,fontSize:11,fontWeight:600,color:T.blue}}>{p}</span>
//             ))}
//           </div>
//         </div>

//         {/* Order Lines */}
//         <div style={{background:T.wh,borderRadius:10,padding:20,border:`1px solid ${T.s200}`,boxShadow:"0 1px 3px rgba(11,18,34,.06)"}}>
//           <div style={{fontSize:10.5,fontWeight:700,color:T.s400,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Order Lines</div>
//           <div style={{fontSize:28,fontWeight:800,color:T.navy}}>{(data.total_rows||0).toLocaleString("en-IN")}</div>
//           <div style={{marginTop:8,fontSize:12,color:T.s400}}>across all uploads</div>
//         </div>

//         {/* Top Products — full width */}
//         <div style={{background:T.wh,borderRadius:10,padding:20,border:`1px solid ${T.s200}`,boxShadow:"0 1px 3px rgba(11,18,34,.06)",gridColumn:"span 3"}}>
//           <div style={{fontSize:10.5,fontWeight:700,color:T.s400,textTransform:"uppercase",letterSpacing:".06em",marginBottom:14}}>Top Products by Revenue</div>
//           {topProds.length === 0
//             ? <div style={{color:T.s300,fontSize:13,padding:"8px 0"}}>No product data — ensure <code style={{fontFamily:T.m,fontSize:12}}>product_name</code> is mapped in Screen 2.</div>
//             : topProds.map((r,i,a)=>(
//               <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
//                 padding:"9px 0",borderBottom:i<a.length-1?`1px solid ${T.s100}`:"none",fontSize:13}}>
//                 <span style={{color:T.navy,fontWeight:550,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:16}}>
//                   <span style={{color:T.s300,marginRight:8,fontSize:11,fontWeight:700,fontFamily:T.m}}>#{i+1}</span>
//                   {r.name}
//                 </span>
//                 <div style={{display:"flex",gap:22,alignItems:"center",flexShrink:0}}>
//                   <span style={{color:T.s400,fontSize:12}}>{fmtUnits(r.units)} units</span>
//                   <span style={{fontWeight:750,color:T.navy,fontFamily:T.m,fontSize:13,minWidth:72,textAlign:"right"}}>{fmt(r.revenue)}</span>
//                 </div>
//               </div>
//             ))
//           }
//         </div>

//       </div>
//     </div>
//   );
// };

/* ===== SCREEN 4: ANALYTICS ===== */
function AnalyticsDashboard({ apiKey }){
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // ── Date range filter ──────────────────────────────────────────────────────
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");

  // ── Platform filter for Brand x Product table ─────────────────────────────
  const [selectedPlatforms, setSelectedPlatforms] = useState([]); // [] = all

  // ── AI Insights ───────────────────────────────────────────────────────────
  const [insights, setInsights]           = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(null);

  const abortRef = useRef(null);

  const buildUrl = (df, dt) => {
    const params = new URLSearchParams();
    if (df) params.set("date_from", df);
    if (dt) params.set("date_to",   dt);
    const q = params.toString();
    return `${API_BASE_URL}/api/analytics/summary${q ? "?" + q : ""}`;
  };

  const fetchData = (df=dateFrom, dt=dateTo) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    fetch(buildUrl(df, dt), { signal: controller.signal, cache: "no-store" })
      .then(r => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => {
        if (e.name === "AbortError") return;
        setError(e.message);
        setLoading(false);
      });
  };

  useEffect(() => { fetchData(); return () => abortRef.current?.abort(); }, []);

  const fmt = (n) => {
    if (n === null || n === undefined) return "—";
    if (n >= 1e7)  return "₹" + (n/1e7).toFixed(2) + "Cr";
    if (n >= 1e5)  return "₹" + (n/1e5).toFixed(1) + "L";
    if (n >= 1000) return "₹" + (n/1000).toFixed(1) + "K";
    return "₹" + Number(n).toLocaleString("en-IN");
  };

  const fmtUnits = (n) => {
    if (!n && n !== 0) return "—";
    if (n >= 1e6) return (n/1e6).toFixed(1) + "M";
    if (n >= 1000) return (n/1000).toFixed(1) + "K";
    return Number(n).toLocaleString("en-IN");
  };

  /* Collapse daily date series → monthly "MMM-YYYY" buckets */
  const collapseToMonthly = (series) => {
    if (!series || series.length === 0) return [];
    const map = {};
    const order = [];
    series.forEach(d => {
      let label = d.date || d.month || "";
      // Parse as local noon to avoid UTC→local timezone shifts flipping the day
      const parts = label.split("-");
      const parsed = parts.length === 3
        ? new Date(+parts[0], +parts[1] - 1, +parts[2], 12, 0, 0)
        : new Date(label);
      if (!isNaN(parsed)) {
        label = parsed.toLocaleString("en-IN", { month: "short", year: "numeric" });
      }
      if (!map[label]) { map[label] = { revenue:0, units:0 }; order.push(label); }
      map[label].revenue += d.revenue || 0;
      map[label].units   += d.units   || 0;
    });
    return order.map(month => ({ month, ...map[month] }));
  };

  /* ── Platform Table ── */
  const PlatformTable = ({ platforms, valueKey, valueFmt }) => {
    if (!platforms || platforms.length === 0) return (
      <div style={{fontSize:12,color:T.s300,padding:"6px 0"}}>No platform data</div>
    );
    const total = platforms.reduce((s,p) => s+(p[valueKey]||0), 0) || 1;
    const COLORS = ["#1B6CA8","#1A7A55","#6047B8","#B85C1A","#1A6A7A","#8A3A6A"];
    return (
      <div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 88px 40px",gap:4,
          padding:"4px 6px",marginBottom:2,
          fontSize:10,fontWeight:700,color:T.s300,textTransform:"uppercase",letterSpacing:".05em",
          borderBottom:`1px solid ${T.s100}`}}>
          <span>Platform</span>
          <span style={{textAlign:"right"}}>{valueKey==="revenue"?"Sales":"Units"}</span>
          <span style={{textAlign:"right"}}>%</span>
        </div>
        {platforms.map((p,i) => {
          const val = p[valueKey]||0;
          const pct = Math.round((val/total)*100);
          return (
            <div key={i} style={{
              display:"grid",gridTemplateColumns:"1fr 88px 40px",gap:4,
              padding:"5px 6px",alignItems:"center",
              background:i%2===0?T.s50:T.wh,borderRadius:4,marginBottom:1
            }}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:8,height:8,borderRadius:2,flexShrink:0,background:COLORS[i%COLORS.length]}}/>
                <span style={{fontSize:11,fontWeight:600,color:T.navy,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
              </div>
              <div style={{textAlign:"right",fontSize:11,fontWeight:700,color:T.navy,fontFamily:T.m}}>
                {valueFmt?valueFmt(val):fmtUnits(val)}
              </div>
              <div style={{textAlign:"right",fontSize:11,color:T.s400,fontFamily:T.m}}>{pct}%</div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ── Horizontal Monthly Bar Chart ── */
  const MonthlyBarChart = ({ series, valueKey, valueFmt, barColor }) => {
    if (!series || series.length === 0) return (
      <div style={{fontSize:12,color:T.s300,padding:"6px 0",textAlign:"center"}}>No monthly data</div>
    );
    const vals = series.map(d => d[valueKey]||0);
    const max  = Math.max(...vals)||1;
    return (
      <div>
        {series.map((d,i) => {
          const pct = (vals[i]/max)*100;
          return (
            <div key={i} style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
              <div style={{width:56,flexShrink:0,fontSize:10,color:T.s500,
                fontWeight:600,textAlign:"right",fontFamily:T.m,lineHeight:1}}>
                {d.month}
              </div>
              <div style={{flex:1,position:"relative",height:20,background:T.s100,borderRadius:3,overflow:"hidden"}}>
                <div style={{
                  position:"absolute",left:0,top:0,bottom:0,
                  width:pct+"%",background:barColor||"#1B6CA8",
                  borderRadius:3,transition:"width .4s ease"
                }}/>
                <span style={{
                  position:"absolute",left:6,top:0,bottom:0,
                  display:"flex",alignItems:"center",
                  fontSize:10,fontWeight:700,whiteSpace:"nowrap",fontFamily:T.m,
                  color:pct>28?"#fff":T.navy
                }}>{valueFmt?valueFmt(vals[i]):fmtUnits(vals[i])}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ── Brand × Product Table ── */
  const BrandProductTable = ({ rows }) => {
    if (!rows || rows.length === 0) return (
      <div style={{fontSize:13,color:T.s300,padding:"24px 0",textAlign:"center"}}>
        No brand/product data — ensure <code style={{fontFamily:T.m,fontSize:11}}>brand</code> and{" "}
        <code style={{fontFamily:T.m,fontSize:11}}>product_name</code> are mapped.
      </div>
    );

    const totalRev   = rows.reduce((s,r) => s+(r.revenue||0), 0)||1;
    const totalUnits = rows.reduce((s,r) => s+(r.units||0),   0)||1;

    /* Group by brand */
    const brandMap = {};
    const brandOrder = [];
    rows.forEach(r => {
      const b = r.brand||"Unknown";
      if (!brandMap[b]) { brandMap[b]=[]; brandOrder.push(b); }
      brandMap[b].push(r);
    });

    const ACCENTS = ["#1B6CA8","#1A7A55","#6047B8","#B85C1A","#1A6A7A","#8A3A6A"];
    const colGrid = "100px 1fr 86px 64px 44px";

    return (
      <div>
        {/* Header */}
        <div style={{display:"grid",gridTemplateColumns:colGrid,gap:6,
          padding:"6px 8px",fontSize:10,fontWeight:700,color:T.s300,
          textTransform:"uppercase",letterSpacing:".05em",
          borderBottom:`2px solid ${T.s200}`,
          position:"sticky",top:0,background:T.wh,zIndex:1}}>
          <span>Brand</span>
          <span>Product</span>
          <span style={{textAlign:"right"}}>Revenue</span>
          <span style={{textAlign:"right"}}>Units</span>
          <span style={{textAlign:"right"}}>Rev %</span>
        </div>

        {brandOrder.map((brand, bi) => {
          const products   = brandMap[brand];
          const brandRev   = products.reduce((s,p)=>s+(p.revenue||0),0);
          const brandUnits = products.reduce((s,p)=>s+(p.units||0),  0);
          const brandPct   = Math.round((brandRev/totalRev)*100);
          const accent     = ACCENTS[bi%ACCENTS.length];

          return (
            <div key={brand}>
              {/* Brand subtotal */}
              <div style={{
                display:"grid",gridTemplateColumns:colGrid,gap:6,
                padding:"6px 8px",marginTop:4,
                background:"#EEF4FB",
                borderLeft:`3px solid ${accent}`,
                borderRadius:"0 4px 4px 0",alignItems:"center"
              }}>
                <div style={{fontSize:11,fontWeight:800,color:accent,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{brand}</div>
                <div style={{fontSize:10,color:T.s400}}>
                  {products.length} product{products.length!==1?"s":""}
                </div>
                <div style={{textAlign:"right",fontSize:11,fontWeight:800,color:T.navy,fontFamily:T.m}}>
                  {fmt(brandRev)}
                </div>
                <div style={{textAlign:"right",fontSize:11,fontWeight:700,color:T.s500,fontFamily:T.m}}>
                  {fmtUnits(brandUnits)}
                </div>
                <div style={{textAlign:"right"}}>
                  <span style={{
                    display:"inline-block",padding:"1px 5px",borderRadius:3,
                    background:accent,color:"#fff",
                    fontSize:10,fontWeight:700,fontFamily:T.m
                  }}>{brandPct}%</span>
                </div>
              </div>

              {/* Product rows */}
              {products.map((p,pi) => {
                const revPct = Math.round(((p.revenue||0)/totalRev)*100);
                return (
                  <div key={pi} style={{
                    display:"grid",gridTemplateColumns:colGrid,gap:6,
                    padding:"5px 8px 5px 14px",
                    background:pi%2===0?T.wh:T.s50,
                    alignItems:"center"
                  }}>
                    <div/>
                    <div style={{fontSize:11,color:T.navy,fontWeight:550,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {p.product_name||p.name}
                    </div>
                    <div style={{textAlign:"right",fontSize:11,fontWeight:650,color:T.navy,fontFamily:T.m}}>
                      {fmt(p.revenue)}
                    </div>
                    <div style={{textAlign:"right",fontSize:11,color:T.s500,fontFamily:T.m}}>
                      {fmtUnits(p.units)}
                    </div>
                    <div style={{textAlign:"right",fontSize:10,color:T.s400,fontFamily:T.m}}>
                      {revPct}%
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Grand total */}
        <div style={{
          display:"grid",gridTemplateColumns:colGrid,gap:6,
          padding:"7px 8px",marginTop:6,
          borderTop:`2px solid ${T.s200}`,background:T.s50
        }}>
          <div style={{fontSize:11,fontWeight:800,color:T.navy,gridColumn:"1/3"}}>Total</div>
          <div style={{textAlign:"right",fontSize:11,fontWeight:800,color:T.navy,fontFamily:T.m}}>
            {fmt(totalRev)}
          </div>
          <div style={{textAlign:"right",fontSize:11,fontWeight:700,color:T.s500,fontFamily:T.m}}>
            {fmtUnits(totalUnits)}
          </div>
          <div style={{textAlign:"right",fontSize:11,fontWeight:700,color:T.navy,fontFamily:T.m}}>100%</div>
        </div>
      </div>
    );
  };

  /* ── Loading / Error / Empty ── */
  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:300,flexDirection:"column",gap:12}}>
      <div style={{width:32,height:32,borderRadius:"50%",border:`3px solid ${T.blueP}`,borderTopColor:T.blue,animation:"spin 0.8s linear infinite"}}/>
      <span style={{color:T.s400,fontSize:13}}>Building unified dataset…</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!data && error) return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{padding:"14px 18px",background:"#FEF2F2",borderRadius:10,border:"1px solid #FECACA",color:"#B91C1C",fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>Failed to load analytics: {error}</span>
        <button onClick={() => fetchData()} style={{marginLeft:16,padding:"5px 12px",background:"#DC2626",color:"#fff",border:"none",borderRadius:6,fontSize:12,cursor:"pointer",fontWeight:600}}>Retry</button>
      </div>
    </div>
  );

  if (!data?.has_data) return (
    <div style={{display:"flex",flexDirection:"column",gap:22}}>
      <header><h2 style={{fontSize:21,fontWeight:750,color:T.navy,margin:0}}>Analytics Dashboard</h2></header>
      <div style={{padding:"40px 24px",background:T.wh,borderRadius:10,border:`1px solid ${T.s200}`,textAlign:"center"}}>
        <div style={{fontSize:36,marginBottom:12}}>📊</div>
        <div style={{fontSize:15,fontWeight:650,color:T.navy,marginBottom:6}}>No data yet</div>
        <div style={{fontSize:13,color:T.s400}}>{data?.message||"Upload files and map columns to see analytics."}</div>
      </div>
    </div>
  );

  const kpis          = data.kpis||{};
  const monthlySeries = collapseToMonthly(kpis.revenue_by_date||[]);
  const platformData  = (kpis.platform_breakdown||[]).map(p=>({
    name:p.platform, revenue:p.revenue, units:p.units
  }));
  const allPlatforms  = data.all_platforms || kpis.platforms || [];
  const brandProductsRaw = kpis.brand_product_breakdown || [];

  // Filter brand×product rows by selected platforms
  const brandProducts = selectedPlatforms.length === 0
    ? brandProductsRaw
    : brandProductsRaw.map(row => {
        const platData = row.platforms || {};
        const filteredRevenue = selectedPlatforms.reduce((s,p) => s + (platData[p]?.revenue||0), 0);
        const filteredUnits   = selectedPlatforms.reduce((s,p) => s + (platData[p]?.units||0),   0);
        return { ...row, revenue: filteredRevenue, units: filteredUnits };
      }).filter(row => row.revenue > 0 || row.units > 0);

  const togglePlatform = (p) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const PLAT_COLORS = ["#1B6CA8","#1A7A55","#6047B8","#B85C1A","#1A6A7A","#8A3A6A"];

  const card = {
    background:T.wh,borderRadius:10,padding:20,
    border:`1px solid ${T.s200}`,boxShadow:"0 1px 3px rgba(11,18,34,.06)"
  };
  const sectionLabel = {
    fontSize:10.5,fontWeight:700,color:T.s400,
    textTransform:"uppercase",letterSpacing:".06em",marginBottom:6
  };

  /* ── Generate AI Insights via Groq API ── */
  const generateInsights = () => {
    if (!apiKey) return;
    setInsightsLoading(true);
    setInsightsError(null);
    setInsights(null);

    // Build a compact text summary of the current analytics data
    const kpis = data?.kpis || {};
    const platformLines = (kpis.platform_breakdown || [])
      .map(p => `  - ${p.platform}: ₹${Number(p.revenue||0).toLocaleString("en-IN")} (${Number(p.units||0).toLocaleString("en-IN")} units)`)
      .join("\n");
    const topProducts = (kpis.brand_product_breakdown || [])
      .slice(0, 10)
      .map(p => `  - ${p.brand||"Unknown"} — ${p.product_name}: ₹${Number(p.revenue||0).toLocaleString("en-IN")} (${Number(p.units||0).toLocaleString("en-IN")} units)`)
      .join("\n");
    const monthlyData = collapseToMonthly(kpis.revenue_by_date || []);
    const monthlyLines = monthlyData
      .map(m => `  - ${m.month}: ₹${Number(m.revenue||0).toLocaleString("en-IN")} (${Number(m.units||0).toLocaleString("en-IN")} units)`)
      .join("\n");

    const summary = `
Total Revenue: ₹${Number(kpis.total_revenue||0).toLocaleString("en-IN")}
Total Units Sold: ${Number(kpis.total_units_sold||0).toLocaleString("en-IN")}
Average Order Value: ₹${Number(kpis.avg_order_value||0).toLocaleString("en-IN")}
Unique SKUs: ${kpis.unique_skus||0}
Platforms: ${(kpis.platforms||[]).join(", ")||"N/A"}
Date range: ${dateFrom||"all time"} to ${dateTo||"present"}

Platform Breakdown:
${platformLines || "  No platform data"}

Top Products by Revenue:
${topProducts || "  No product data"}

Monthly Revenue Trend:
${monthlyLines || "  No monthly data"}
`.trim();

    const prompt = `You are a senior e-commerce analytics consultant. Analyze this sales data and provide sharp, actionable insights.

${summary}

Respond with exactly these 4 sections using this format:

**Performance Summary**
2-3 sentences on overall performance with key numbers.

**Top Performers**
- Bullet points on best brands/products with specific revenue figures

**Trends**
- Bullet points on monthly/seasonal patterns you observe

**Recommendations**
- 2-3 specific, actionable recommendations based on the data

Keep it concise and data-driven. Use actual numbers from the data.`;

    fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.choices?.[0]?.message?.content) {
          setInsights(d.choices[0].message.content);
        } else {
          setInsightsError(d.error?.message || "No insights returned.");
        }
        setInsightsLoading(false);
      })
      .catch(e => { setInsightsError(e.message); setInsightsLoading(false); });
  };

  /* ── Render markdown-like insights text ── */
  const renderInsights = (text) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      // Section headers: **Bold Header**
      if (/^\*\*(.+)\*\*$/.test(line.trim())) {
        return (
          <div key={i} style={{fontWeight:750,color:T.navy,fontSize:13,
            marginTop:i===0?0:14,marginBottom:5,
            paddingBottom:4,borderBottom:`1px solid ${T.s100}`}}>
            {line.trim().replace(/\*\*/g,"")}
          </div>
        );
      }
      // Bullet lines
      if (/^[-•]\s/.test(line.trim())) {
        const content = line.trim().slice(2).replace(/\*\*(.*?)\*\*/g,"$1");
        return (
          <div key={i} style={{display:"flex",gap:7,marginBottom:4,paddingLeft:4}}>
            <span style={{color:T.blue,flexShrink:0,marginTop:1}}>•</span>
            <span style={{fontSize:12,color:T.navy,lineHeight:1.55}}>{content}</span>
          </div>
        );
      }
      // Empty lines
      if (!line.trim()) return <div key={i} style={{height:4}}/>;
      // Regular paragraph text
      const content = line.replace(/\*\*(.*?)\*\*/g,"$1");
      return (
        <div key={i} style={{fontSize:12,color:T.s600||T.navy,lineHeight:1.6,marginBottom:3}}>
          {content}
        </div>
      );
    });
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>

      {error && (
        <div style={{padding:"12px 16px",background:"#FEF2F2",borderRadius:8,border:"1px solid #FECACA",color:"#B91C1C",fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>Filter failed: {error}</span>
          <button onClick={() => fetchData()} style={{marginLeft:16,padding:"4px 12px",background:"#DC2626",color:"#fff",border:"none",borderRadius:6,fontSize:12,cursor:"pointer",fontWeight:600}}>Retry</button>
        </div>
      )}

      {data?.date_filter_warning && (
        <div style={{padding:"10px 16px",background:"#FFFBEB",borderRadius:8,border:"1px solid #FDE68A",color:"#92400E",fontSize:12}}>
          ⚠ {data.date_filter_warning}
        </div>
      )}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:21,fontWeight:750,color:T.navy,margin:0}}>Analytics Dashboard</h2>
          <p style={{color:T.s500,fontSize:13,margin:"5px 0 0"}}>
            Live data · {allPlatforms.length} platform{allPlatforms.length!==1?"s":""} · {(data.total_rows||0).toLocaleString("en-IN")} order lines
          </p>
        </div>

        {/* ── Date range filter ── */}
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:11,fontWeight:650,color:T.s400}}>From</span>
          <input
            type="date" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{padding:"6px 10px",border:`1px solid ${T.s200}`,borderRadius:7,
              fontSize:12,color:T.navy,fontFamily:T.f,cursor:"pointer",outline:"none"}}
          />
          <span style={{fontSize:11,fontWeight:650,color:T.s400}}>To</span>
          <input
            type="date" value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{padding:"6px 10px",border:`1px solid ${T.s200}`,borderRadius:7,
              fontSize:12,color:T.navy,fontFamily:T.f,cursor:"pointer",outline:"none"}}
          />
          <button
            onClick={() => fetchData(dateFrom, dateTo)}
            style={{padding:"6px 14px",background:T.navy,color:T.wh,border:"none",
              borderRadius:7,fontSize:12,fontWeight:650,cursor:"pointer"}}>
            Apply
          </button>
          {(dateFrom||dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); fetchData("",""); }}
              style={{padding:"6px 12px",background:T.s100,color:T.s500,border:"none",
                borderRadius:7,fontSize:12,fontWeight:650,cursor:"pointer"}}>
              Clear
            </button>
          )}
          <button onClick={() => fetchData()}
            style={{padding:"6px 14px",background:T.s50,color:T.navy,border:`1px solid ${T.s200}`,
              borderRadius:7,fontSize:12,fontWeight:650,cursor:"pointer"}}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Top 3-column layout: Revenue | Units | Insights ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1.5fr",gap:14,alignItems:"start"}}>

        {/* ══ REVENUE COLUMN ══ */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* Card 1: Total Revenue */}
          <div style={{...card,display:"flex",flexDirection:"column"}}>
            <div style={sectionLabel}>Total Revenue (GMV)</div>
            <div style={{fontSize:30,fontWeight:800,color:T.navy,marginBottom:2,fontFamily:T.m}}>
              {fmt(kpis.total_revenue)}
            </div>
            <div style={{fontSize:11,color:T.s400,marginBottom:0}}>
              across {(kpis.platforms||[]).length} platforms
            </div>
          </div>

          {/* Card 2: Revenue by Platform */}
          <div style={{...card,display:"flex",flexDirection:"column"}}>
            <div style={{...sectionLabel,marginBottom:8}}>Revenue by Platform</div>
            <PlatformTable platforms={platformData} valueKey="revenue" valueFmt={fmt}/>
          </div>

          {/* Card 3: Revenue by Month */}
          <div style={{...card,display:"flex",flexDirection:"column"}}>
            <div style={{...sectionLabel,marginBottom:8}}>Revenue by Month</div>
            <MonthlyBarChart series={monthlySeries} valueKey="revenue" valueFmt={fmt} barColor="#1B6CA8"/>
          </div>

        </div>

        {/* ══ UNITS COLUMN ══ */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* Card 1: Total Units */}
          <div style={{...card,display:"flex",flexDirection:"column"}}>
            <div style={sectionLabel}>Total Units Sold</div>
            <div style={{fontSize:30,fontWeight:800,color:T.navy,marginBottom:2,fontFamily:T.m}}>
              {fmtUnits(kpis.total_units_sold)}
            </div>
            <div style={{fontSize:11,color:T.s400,marginBottom:0}}>
              {kpis.unique_skus||0} unique SKUs · avg {fmt(kpis.avg_order_value)}/unit
            </div>
          </div>

          {/* Card 2: Units by Platform */}
          <div style={{...card,display:"flex",flexDirection:"column"}}>
            <div style={{...sectionLabel,marginBottom:8}}>Units by Platform</div>
            <PlatformTable platforms={platformData} valueKey="units" valueFmt={fmtUnits}/>
          </div>

          {/* Card 3: Units by Month */}
          <div style={{...card,display:"flex",flexDirection:"column"}}>
            <div style={{...sectionLabel,marginBottom:8}}>Units by Month</div>
            <MonthlyBarChart series={monthlySeries} valueKey="units" valueFmt={fmtUnits} barColor="#1A7A55"/>
          </div>

        </div>

        {/* ══ AI INSIGHTS PANEL ══ */}
        <div style={{...card,display:"flex",flexDirection:"column",minHeight:420}}>

          {/* Panel header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
            <div>
              <div style={{...sectionLabel,marginBottom:2}}>AI Insights</div>
              <div style={{fontSize:10.5,color:T.s300}}>Llama 3.3 · Groq</div>
            </div>
            <button
              onClick={generateInsights}
              disabled={insightsLoading || !apiKey}
              style={{
                padding:"7px 14px",
                background: !apiKey ? T.s100 : insightsLoading ? "#E8EFF8" : T.navy,
                color: !apiKey ? T.s300 : insightsLoading ? T.blue : T.wh,
                border: insightsLoading ? `1px solid ${T.blueP}` : "none",
                borderRadius:7,fontSize:12,fontWeight:650,
                cursor: insightsLoading || !apiKey ? "not-allowed" : "pointer",
                whiteSpace:"nowrap",transition:"all .2s",
                display:"flex",alignItems:"center",gap:6,
              }}>
              {insightsLoading
                ? <><span style={{width:11,height:11,borderRadius:"50%",border:`2px solid ${T.blueP}`,borderTopColor:T.blue,display:"inline-block",animation:"spin 0.8s linear infinite"}}/>Analyzing…</>
                : <><span style={{fontSize:14}}>✦</span>Generate</>
              }
            </button>
          </div>

          {/* No API key notice */}
          {!apiKey && (
            <div style={{padding:"11px 14px",background:"#FFFBEB",borderRadius:7,
              border:"1px solid #FFE082",fontSize:12,color:"#92400E",lineHeight:1.5}}>
              Add your <strong>Groq API key</strong> in Settings to enable AI insights.
            </div>
          )}

          {/* Error */}
          {insightsError && (
            <div style={{padding:"11px 14px",background:"#FEF2F2",borderRadius:7,
              border:`1px solid #FECACA`,fontSize:12,color:T.red,lineHeight:1.5}}>
              {insightsError}
            </div>
          )}

          {/* Insights content */}
          {insights && !insightsLoading && (
            <div style={{fontSize:12,lineHeight:1.6,color:T.navy,overflowY:"auto",flex:1,
              paddingRight:4,maxHeight:480}}>
              {renderInsights(insights)}
            </div>
          )}

          {/* Empty state */}
          {!insights && !insightsLoading && !insightsError && apiKey && (
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
              justifyContent:"center",gap:10,color:T.s300,paddingTop:20}}>
              <div style={{fontSize:32,opacity:.5}}>✦</div>
              <div style={{fontSize:13,fontWeight:650,color:T.s400}}>AI-powered sales insights</div>
              <div style={{fontSize:11,color:T.s300,textAlign:"center",maxWidth:200,lineHeight:1.5}}>
                Click <strong style={{color:T.navy}}>Generate</strong> to get an LLM analysis of your current data
              </div>
            </div>
          )}

        </div>

      </div>

      {/* ── Brand × Product Table (full width, below charts) ── */}
      <div style={{...card,display:"flex",flexDirection:"column"}}>
        <div style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={sectionLabel}>Sale by Brand &amp; Product</div>
            {selectedPlatforms.length > 0 && (
              <button
                onClick={() => setSelectedPlatforms([])}
                style={{fontSize:10,fontWeight:650,color:T.s400,background:"none",
                  border:"none",cursor:"pointer",padding:"2px 6px",borderRadius:4,
                  textDecoration:"underline"}}>
                Clear filter
              </button>
            )}
          </div>
          {/* Platform toggle chips */}
          {allPlatforms.length > 0 && (
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {allPlatforms.map((p,i) => {
                const active = selectedPlatforms.includes(p);
                const col = PLAT_COLORS[i % PLAT_COLORS.length];
                return (
                  <button key={p} onClick={() => togglePlatform(p)}
                    style={{
                      padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:650,
                      cursor:"pointer",transition:"all .15s",
                      border:`1.5px solid ${active ? col : T.s200}`,
                      background: active ? col : T.wh,
                      color: active ? "#fff" : T.s500,
                      boxShadow: active ? `0 1px 4px ${col}55` : "none",
                    }}>
                    {p}
                  </button>
                );
              })}
            </div>
          )}
          {selectedPlatforms.length > 0 && (
            <div style={{marginTop:6,fontSize:11,color:T.s400}}>
              Showing data for: <strong style={{color:T.navy}}>{selectedPlatforms.join(", ")}</strong>
            </div>
          )}
        </div>
        <div style={{overflowY:"auto",maxHeight:480}}>
          <BrandProductTable rows={brandProducts}/>
        </div>
      </div>

    </div>
  );
};

// ── MAIN APP SHELL ─────────────────────────────────────────────────────────────
export default function App() {
  // ── ALL hooks must come first — no conditional returns before this block ──

  // Auth
  const [currentUser, setCurrentUser] = useState(null);

  // App state
  const [activeScreen, setActiveScreen] = useState(0);
  const [mounted, setMounted]           = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [refreshKey, setRefreshKey]     = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey]             = useState(() => localStorage.getItem("dataagent_api_key") || "");
  const [apiKeyInput, setApiKeyInput]   = useState(() => localStorage.getItem("dataagent_api_key") || "");
  const [apiKeySaved, setApiKeySaved]   = useState(false);

  // Called by DataIngestionHub whenever the file list changes (upload or delete)
  const handleFilesChange = useCallback((files) => {
    setUploadedFiles(files);
    setRefreshKey(k => k + 1);
  }, []);

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    localStorage.setItem("dataagent_api_key", trimmed);
    setApiKey(trimmed);
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2500);
  };

  useEffect(() => {
    setMounted(true);
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=JetBrains+Mono:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  // ── Auth handlers ─────────────────────────────────────────────────────────
  const handleLogin  = (user) => setCurrentUser(user);
  const handleLogout = async () => {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: "POST", credentials: "include",
    }).catch(() => {});
    setCurrentUser(null);
  };

  // ── Auth gate — conditional return AFTER all hooks ────────────────────────
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const navItems = [
    { icon: <Icons.Database />, label: "Ingestion", screen: 0 },
    { icon: <Icons.Mapping />,  label: "Mapping",   screen: 1 },
    { icon: <Icons.Sparkle />,  label: "Standardize", screen: 2 },
    { icon: <Icons.Chart />,    label: "Analytics", screen: 3 },
  ];

  const screens = [
    <DataIngestionHub key={0} onFilesChange={handleFilesChange} />,
    <MappingCleaning  key={1} uploadedFiles={uploadedFiles} refreshKey={refreshKey} />,
    <ProductStandardization key={2} apiKey={apiKey} uploadedFiles={uploadedFiles} refreshKey={refreshKey} />,
    <AnalyticsDashboard     key={3} apiKey={apiKey} />,
  ];

  return (
    <div style={{
      display: "flex", height: "100vh", width: "100%",
      background: COLORS.bg, fontFamily: FONTS.body,
      opacity: mounted ? 1 : 0, transition: "opacity 0.4s ease",
    }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: COLORS.sidebar, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "22px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #2563EB, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icons.Sparkle />
            </div>
            <div>
              <div style={{ fontFamily: FONTS.display, fontSize: 14, fontWeight: 700, color: "white", letterSpacing: "-0.01em" }}>DataAgent</div>
              <div style={{ fontFamily: FONTS.body, fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: "0.04em" }}>ECOMMERCE PLATFORM</div>
            </div>
          </div>
        </div>
        <div style={{ padding: "16px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontFamily: FONTS.body, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "6px 10px", marginBottom: 4 }}>Workspace</div>
          {navItems.map((item) => (
            <button key={item.screen} onClick={() => setActiveScreen(item.screen)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: 8, border: "none", width: "100%", textAlign: "left",
              background: activeScreen === item.screen ? COLORS.sidebarActive : "transparent",
              color: activeScreen === item.screen ? "white" : "rgba(255,255,255,0.55)",
              fontFamily: FONTS.body, fontSize: 13, fontWeight: 500, cursor: "pointer",
              transition: "all 0.15s ease",
            }}>
              {item.icon}
              {item.label}
              {item.screen === 1 && uploadedFiles.length > 0 && (
                <span style={{
                  marginLeft: "auto", width: 18, height: 18, borderRadius: 5,
                  background: COLORS.warning, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: FONTS.mono, fontSize: 10, fontWeight: 700, color: "white",
                }}>{uploadedFiles.length}</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ marginTop: "auto", padding: "16px 10px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Logged-in user strip */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px 12px" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #2563EB, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0 }}>
              {(currentUser?.full_name || currentUser?.username || "U").slice(0,2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentUser?.full_name || currentUser?.username}
              </div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", textTransform: "capitalize" }}>
                {currentUser?.role || "official"}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(s => !s)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "none", width: "100%", textAlign: "left", background: showSettings ? "rgba(255,255,255,0.08)" : "transparent", color: showSettings ? "white" : "rgba(255,255,255,0.45)", fontFamily: FONTS.body, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all .15s" }}>
            <Icons.Settings /> Settings
            {apiKey && <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: T.grn, flexShrink: 0 }} />}
          </button>

          {/* Settings panel — slides open above the button */}
          {showSettings && (
            <div style={{ marginBottom: 8, background: "rgba(255,255,255,0.05)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", padding: "14px 14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: ".07em" }}>Settings</span>
                <button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
              </div>

              {/* API Key section */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icons.Key />
                  <span style={{ fontSize: 11.5, fontWeight: 650, color: "rgba(255,255,255,0.75)" }}>Anthropic API Key</span>
                </div>
                <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.5 }}>
                  Used for AI-powered product name suggestions in Standardize.
                </p>
                <div style={{ position: "relative" }}>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={e => { setApiKeyInput(e.target.value); setApiKeySaved(false); }}
                    onKeyDown={e => e.key === "Enter" && handleSaveApiKey()}
                    placeholder="sk-ant-..."
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "8px 10px", borderRadius: 7,
                      border: `1px solid ${apiKey ? "rgba(22,163,74,0.5)" : "rgba(255,255,255,0.15)"}`,
                      background: "rgba(0,0,0,0.25)", color: "white",
                      fontSize: 11.5, fontFamily: T.m, outline: "none",
                    }}
                  />
                </div>
                {apiKey && !apiKeySaved && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "rgba(22,163,74,0.8)" }}>
                    <span>●</span> Key connected
                  </div>
                )}
                <button
                  onClick={handleSaveApiKey}
                  disabled={!apiKeyInput.trim() || apiKeyInput.trim() === apiKey}
                  style={{
                    padding: "8px 0", borderRadius: 7, border: "none", cursor: (!apiKeyInput.trim() || apiKeyInput.trim() === apiKey) ? "not-allowed" : "pointer",
                    background: apiKeySaved ? T.grn : (!apiKeyInput.trim() || apiKeyInput.trim() === apiKey) ? "rgba(255,255,255,0.08)" : T.blue,
                    color: (!apiKeyInput.trim() || apiKeyInput.trim() === apiKey) ? "rgba(255,255,255,0.25)" : "white",
                    fontSize: 12, fontWeight: 700, transition: "all .2s",
                  }}
                >
                  {apiKeySaved ? "✓ Saved!" : "Apply"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ height: 56, background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", background: COLORS.surfaceAlt, borderRadius: 8, border: `1px solid ${COLORS.border}`, width: 260 }}>
            <Icons.Search />
            <span style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted }}>Search products, fields, sources...</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative", cursor: "pointer", color: COLORS.textMuted }}>
              <Icons.Bell />
              {uploadedFiles.length > 0 && (
                <span style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: "50%", background: COLORS.error, border: `2px solid ${COLORS.surface}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.mono, fontSize: 8, fontWeight: 700, color: "white" }}>
                  {uploadedFiles.length}
                </span>
              )}
            </div>
            {/* User chip + logout */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 10px 4px 4px", background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 20, cursor: "default" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.primary}, #7C3AED)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.display, fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0 }}>
                  {(currentUser?.full_name || currentUser?.username || "U").slice(0,2).toUpperCase()}
                </div>
                <span style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.text, fontWeight: 500, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {currentUser?.full_name || currentUser?.username}
                </span>
              </div>
              <button
                title="Sign out"
                onClick={handleLogout}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, background: "transparent", border: `1px solid ${COLORS.border}`, cursor: "pointer", color: COLORS.textMuted, transition: "background 0.15s, color 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.borderColor = "#FCA5A5"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = COLORS.textMuted; e.currentTarget.style.borderColor = COLORS.border; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {screens[activeScreen]}
        </div>
      </div>
    </div>
  );
}
