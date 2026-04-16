"use client";

import React from "react";

const MOCK_WORKFLOWS = [
  { id: "wf-001", name: "Full Catalog Sync", trigger: "scheduled", schedule: "0 2 * * *", supplier: "SanMar Corporation", status: "active", last_run: "2026-04-15 02:00", next_run: "2026-04-16 02:00" },
  { id: "wf-002", name: "Delta Inventory Sync", trigger: "scheduled", schedule: "*/30 * * * *", supplier: "S&S Activewear", status: "active", last_run: "2026-04-15 14:30", next_run: "2026-04-15 15:00" },
  { id: "wf-003", name: "Pricing Update", trigger: "webhook", schedule: "—", supplier: "alphabroder", status: "active", last_run: "2026-04-14 11:22", next_run: "on event" },
  { id: "wf-004", name: "Full Catalog Push", trigger: "manual", schedule: "—", supplier: "4Over", status: "paused", last_run: "2026-04-13 09:00", next_run: "—" },
];

export default function WorkflowsPage() {
  return (
    <div className="screen active" id="s-workflows">
      <div className="page-header">
        <div>
          <div className="page-title">Workflows</div>
          <div className="page-subtitle">
            n8n pipeline definitions and sync schedules
          </div>
        </div>
        <button className="btn btn-ghost">Open n8n Editor</button>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="stat-card">
          <div className="stat-label">Active Workflows</div>
          <div className="stat-value">03</div>
          <div className="stat-note">Running normally</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Paused</div>
          <div className="stat-value" style={{ color: "var(--orange)" }}>01</div>
          <div className="stat-note" style={{ color: "var(--orange)" }}>Auth error</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Runs Today</div>
          <div className="stat-value">48</div>
          <div className="stat-note">+12 vs yesterday</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Pipeline Definitions</div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--ink-muted)",
            }}
          >
            {MOCK_WORKFLOWS.length} workflows
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Supplier</th>
              <th>Trigger</th>
              <th>Schedule</th>
              <th>Last Run</th>
              <th>Next Run</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_WORKFLOWS.map((w) => (
              <tr key={w.id}>
                <td className="cell-primary">{w.name}</td>
                <td>{w.supplier}</td>
                <td>
                  <span className="cell-tag">{w.trigger}</span>
                </td>
                <td className="cell-mono">{w.schedule}</td>
                <td className="cell-mono">{w.last_run}</td>
                <td className="cell-mono">{w.next_run}</td>
                <td>
                  {w.status === "active" ? (
                    <span className="badge badge-ok">
                      <span className="badge-dot"></span> Active
                    </span>
                  ) : (
                    <span className="badge badge-err">
                      <span className="badge-dot"></span> Paused
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
