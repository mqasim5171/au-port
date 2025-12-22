import React, { useEffect, useState } from "react";
import api from "../api";

export default function Reminders() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setErr("");
    try {
      const res = await api.get("/api/reminders/inbox?limit=100");
      setItems(res.data || []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load reminders");
    }
  };

  useEffect(() => { load(); }, []);

  const callAdmin = async (path) => {
    setBusy(true);
    setErr("");
    try {
      await api.post(path);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const ack = async (id) => {
    setBusy(true);
    setErr("");
    try {
      await api.post(`/api/reminders/ack/${id}`);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to ack");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <h2>Reminders & Escalations</h2>
        <p className="muted">
          Central inbox for missing uploads and pending QA actions. (Admin can bootstrap + run engine)
        </p>

        {err && <div className="alert alert-danger">{err}</div>}

        <div className="row" style={{ gap: 10, marginTop: 10 }}>
          <button className="btn-primary" disabled={busy} onClick={() => callAdmin("/api/reminders/bootstrap")}>
            Bootstrap Tables
          </button>
          <button className="btn-primary" disabled={busy} onClick={() => callAdmin("/api/reminders/init-defaults")}>
            Init Default Rules
          </button>
          <button className="btn-primary" disabled={busy} onClick={() => callAdmin("/api/reminders/run")}>
            Run Engine Now
          </button>
          <button className="btn" disabled={busy} onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Inbox</h3>

        {items.length === 0 ? (
          <p className="muted">No reminders.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((n) => (
              <div key={n.id} className="card" style={{ border: "1px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {n.payload?.rule_code || "REMINDER"} — Step {n.payload?.step_no}
                    </div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {n.payload?.message || n.payload?.reason || "Pending action"}
                    </div>
                    <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                      Target: {n.target_key} • Status: {n.status}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {n.status !== "acked" && (
                      <button className="btn-primary" disabled={busy} onClick={() => ack(n.id)}>
                        Mark Done
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
