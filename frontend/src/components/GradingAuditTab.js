// src/components/GradingAuditTab.js
import React, { useMemo } from "react";
// If you already use recharts / chart lib, plug here

export default function GradingAuditTab({ auditData, onRunAudit }) {
  const dist = useMemo(
    () => auditData.find((a) => a.metric === "distribution"),
    [auditData]
  );
  const outliers = useMemo(
    () => auditData.find((a) => a.metric === "outliers"),
    [auditData]
  );
  const cloAvg = useMemo(
    () => auditData.find((a) => a.metric === "clo_avg"),
    [auditData]
  );

  return (
    <div className="card">
      <div className="card-header">
        <h3>Grading Audit</h3>
        <button className="btn-primary" onClick={onRunAudit}>
          Run Audit
        </button>
      </div>

      {dist && (
        <section>
          <h4>Marks Distribution</h4>
          <p>
            Mean: {dist.value.mean?.toFixed(2)} | Median:{" "}
            {dist.value.median?.toFixed(2)} | Std Dev:{" "}
            {dist.value.std?.toFixed(2)}
          </p>
          {/* Later: plug in a chart here */}
        </section>
      )}

      {outliers && (
        <section>
          <h4>Outliers</h4>
          <p>Count: {outliers.value.count}</p>
        </section>
      )}

      {cloAvg && (
        <section>
          <h4>CLO-wise Average (this assessment)</h4>
          <ul>
            {Object.entries(cloAvg.value).map(([cloId, avg]) => (
              <li key={cloId}>
                CLO {cloId}: {(avg * 100).toFixed(1)}%
              </li>
            ))}
          </ul>
        </section>
      )}

      {!dist && <p>No audit data yet. Click “Run Audit”.</p>}
    </div>
  );
}
