import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VetTiers — Tiered Treatment Plans for Vet Clinics";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #020617 0%, #0f172a 50%, #064e3b 100%)",
          padding: "72px 80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#f8fafc",
        }}
      >
        {/* Top row — brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, #10b981, #059669)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 700,
              color: "#022c22",
            }}
          >
            V
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>VetTiers</div>
        </div>

        {/* Headline block */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 16px",
              borderRadius: 999,
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              color: "#6ee7b7",
              fontSize: 20,
              fontWeight: 500,
              alignSelf: "flex-start",
            }}
          >
            For US veterinary clinics
          </div>
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              maxWidth: 1040,
            }}
          >
            Recover <span style={{ color: "#10b981" }}>$80,000/year</span>
            <br />in declined treatments.
          </div>
          <div style={{ fontSize: 26, color: "#94a3b8", maxWidth: 920, lineHeight: 1.3 }}>
            Tiered treatment plans + inline financing — so clients say yes instead of &ldquo;let me think about it.&rdquo;
          </div>
        </div>

        {/* Bottom row — stats + URL */}
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 48 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#10b981" }}>52%</div>
              <div style={{ fontSize: 18, color: "#94a3b8" }}>of plans declined</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#10b981" }}>73%</div>
              <div style={{ fontSize: 18, color: "#94a3b8" }}>never offered alternative</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#10b981" }}>$60K</div>
              <div style={{ fontSize: 18, color: "#94a3b8" }}>lost per vet / year</div>
            </div>
          </div>
          <div style={{ fontSize: 20, color: "#64748b" }}>vettiers.vercel.app</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
