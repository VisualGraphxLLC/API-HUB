"use client";

import React, { useState } from "react";

const MOCK_JOBS = [
  { id: "job-001", supplier: "SanMar Corporation", type: "full", status: "completed", records: 12450, duration: "42.4s", started: "2026-04-15 02:00:01", finished: "2026-04-15 02:00:43" },
  { id: "job-002", supplier: "S&S Activewear", type: "pricing", status: "completed", records: 8201, duration: "18.1s", started: "2026-04-15 14:30:00", finished: "2026-04-15 14:30:18" },
  { id: "job-003", supplier: "alphabroder", type: "delta", status: "completed", records: 11800, duration: "1m 12s", started: "2026-04-15 12:00:00", finished: "2026-04-15 12:01:12" },
  { id: "job-004", supplier: "4Over", type: "full", status: "failed", records: 0, duration: "2.2s", started: "2026-04-15 09:00:00", finished: "2026-04-15 09:00:02" },
  { id: "job-005", supplier: "SanMar Corporation", type: "inventory", status: "running", records: 3200, duration: "—", started: "2026-04-15 15:00:00", finished: "—" },
];

const STATUS_BADGE: Record<string, string> = {
  completed: "badge-ok",
  failed: "badge-err",
  running: "badge-ok",
  pending: "badge-err",
};

export default function SyncJobsPage() {
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? MOCK_JOBS : MOCK_JOBS.filter((j) => j.status === filter);

  return (
    <div className="screen active" id="s-sync">
      <div className="page-header">
        <div>
          <div className="page-title">Sync Jobs</div>
          <div className="page-subtitle">
            Real-time and historical sync operation log
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {["all", "completed", "running", "failed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={filter === f ? "btn btn-primary" : "btn btn-ghost"}
              style={{ padding: "8px 14px", fontSize: "12px", textTransform: "capitalize" }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-card">
          <div className="stat-label">Total Jobs</div>
          <div className="stat-value">{MOCK_JOBS.length}</div>
          <div className="stat-note">last 24h</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{MOCK_JOBS.filter((j) => j.status === "completed").length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Running</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>
            {MOCK_JOBS.filter((j) => j.status === "running").length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Failed</div>
          <div className="stat-value" style={{ color: "var(--red)" }}>
            {MOCK_JOBS.filter((j) => j.status === "failed").length}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Job History</div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--blue)",
            }}
          >
            LIVE_STREAMING
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Job ID</th>
              <th>Supplier</th>
              <th>Type</th>
              <th>Records</th>
              <th>Duration</th>
              <th>Started</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((j) => (
              <tr key={j.id}>
                <td className="cell-mono" style={{ color: "var(--ink-faint)" }}>{j.id}</td>
                <td className="cell-primary">{j.supplier}</td>
                <td>
                  <span className="cell-tag">{j.type}</span>
                </td>
                <td className="cell-mono">{j.records.toLocaleString()}</td>
                <td className="cell-mono">{j.duration}</td>
                <td className="cell-mono">{j.started}</td>
                <td>
                  <span className={`badge ${STATUS_BADGE[j.status]}`}>
                    <span className="badge-dot"></span>
                    {j.status.charAt(0).toUpperCase() + j.status.slice(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
