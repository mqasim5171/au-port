// Admin.jsx
// ✅ FULL FILE (keeps ALL your existing features) + ✅ NEW FEATURE:
// - Edit existing Instructor / Course Lead (username, email, department, optional password reset)
//
// NOTE:
// This file assumes your backend has:
//   PUT /admin/users/{user_id}  -> updates {username,email,department,password?}
// and existing endpoints you already use:
//   GET /courses
//   GET /admin/users?role=instructor
//   GET /admin/users?role=course_lead
//   POST /admin/users
//   POST /admin/courses
//   POST /admin/courses/{courseId}/assign
//   PUT  /admin/courses/{courseId}/clos
//
// ✅ I did NOT remove any of your old sections:
// - Create Teacher User
// - Create Course
// - Assign Staff
// - Set CLOs
// ✅ I ONLY ADDED the new "Edit Teacher / Course Lead" section at the end.

import React, { useEffect, useMemo, useState } from "react";
import api from "../api";

const styles = {
  page: { display: "grid", gap: 16 },
  headerCard: {
    background: "#fff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    padding: 16,
  },
  card: {
    background: "#fff",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    padding: 16,
  },
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  h2: { margin: 0, fontSize: 22 },
  h3: { margin: 0, fontSize: 18 },
  hint: { marginTop: 6, opacity: 0.75, lineHeight: 1.4 },
  grid: { display: "grid", gap: 10 },
  row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    outline: "none",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    outline: "none",
    background: "#fff",
  },
  btn: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
  },
  btnDanger: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #dc2626",
    background: "#fff",
    color: "#dc2626",
    cursor: "pointer",
  },
  btnPrimary: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #1d4ed8",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
  },
  chip: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontSize: 12,
    opacity: 0.9,
    whiteSpace: "nowrap",
  },
  divider: { height: 1, background: "#e5e7eb", margin: "12px 0" },
  small: { fontSize: 12, opacity: 0.8, lineHeight: 1.4 },
};

function safeParseClos(raw) {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .map((x) => {
        if (typeof x === "string") return { code: x, description: "" };
        return {
          code: (x?.code || "").toString(),
          description: (x?.description || "").toString(),
        };
      })
      .filter((c) => c.code || c.description);
  } catch {
    return [];
  }
}

function normalizeRoleLabel(role) {
  const r = (role || "").toString().toLowerCase();
  if (r.includes("course") && r.includes("lead")) return "course_lead";
  if (r.includes("instructor")) return "instructor";
  if (r.includes("admin")) return "admin";
  return role || "unknown";
}

function formatUserOption(u) {
  const role = normalizeRoleLabel(u?.role);
  const name = u?.full_name || "Unknown";
  const username = u?.username ? `@${u.username}` : "";
  return `${name} ${username} (${role})`;
}

export default function Admin({ user }) {
  const isAdmin = useMemo(
    () => (user?.role || "").toLowerCase().includes("admin"),
    [user]
  );

  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [courseLeads, setCourseLeads] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");

  // ✅ Create Course form (existing)
  const [form, setForm] = useState({
    course_code: "",
    course_name: "",
    semester: "Fall",
    year: "2025",
    department: "",
  });

  // ✅ CLO editing state (existing)
  const [clos, setClos] = useState([{ code: "CLO1", description: "" }]);

  // ✅ Assign staff state (existing)
  const [assign, setAssign] = useState({ instructorId: "", courseLeadId: "" });

  // ✅ Create Teacher User form (existing)
  const [newUser, setNewUser] = useState({
    full_name: "",
    username: "",
    email: "",
    department: "",
    role: "instructor",
    password: "Teacher@12345",
  });

  // ✅ NEW: Edit existing teacher / course lead
  const [allTeachers, setAllTeachers] = useState([]);
  const [editUserId, setEditUserId] = useState("");
  const [editForm, setEditForm] = useState({
    username: "",
    email: "",
    department: "",
    password: "",
  });

  // ✅ optional UI helpers for edit section
  const [savingEdit, setSavingEdit] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [cRes, iRes, lRes] = await Promise.all([
        api.get("/courses"),
        api.get("/admin/users?role=instructor"),
        api.get("/admin/users?role=course_lead"),
      ]);

      const cList = cRes.data || [];
      setCourses(cList);

      const instr = iRes.data || [];
      const leads = lRes.data || [];

      setInstructors(instr);
      setCourseLeads(leads);

      // ✅ NEW: combined list for editing
      setAllTeachers([...(instr || []), ...(leads || [])]);

      if (!selectedCourseId && cList.length) {
        setSelectedCourseId(cList[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    load().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // ✅ When selected course changes, load its CLOs from courses list (existing)
  useEffect(() => {
    if (!selectedCourseId) return;
    const course = courses.find((c) => c.id === selectedCourseId);
    const parsed = safeParseClos(course?.clos);
    if (parsed.length) setClos(parsed);
    else setClos([{ code: "CLO1", description: "" }]);
  }, [selectedCourseId, courses]);

  if (!isAdmin) {
    return (
      <div style={styles.card}>
        <h2 style={styles.h2}>Admin</h2>
        <p style={styles.hint}>You do not have access to this page.</p>
      </div>
    );
  }

  // ============================
  // Existing handlers (kept)
  // ============================

  const createCourse = async (e) => {
    e.preventDefault();
    await api.post("/admin/courses", {
      ...form,
      instructor: "",
      clos: "[]",
    });
    await load();
    alert("Course created");
    setForm({
      course_code: "",
      course_name: "",
      semester: "Fall",
      year: "2025",
      department: "",
    });
  };

  const assignStaff = async () => {
    if (!selectedCourseId) return alert("Select a course first");

    if (assign.instructorId) {
      await api.post(`/admin/courses/${selectedCourseId}/assign`, {
        user_id: assign.instructorId,
        role: "INSTRUCTOR",
      });
    }

    if (assign.courseLeadId) {
      await api.post(`/admin/courses/${selectedCourseId}/assign`, {
        user_id: assign.courseLeadId,
        role: "COURSE_LEAD",
      });
    }

    alert("Assigned");
  };

  const saveClos = async () => {
    if (!selectedCourseId) return alert("Select a course first");
    const cleaned = clos
      .map((c) => ({
        code: (c.code || "").trim(),
        description: (c.description || "").trim(),
      }))
      .filter((c) => c.code && c.description);

    await api.put(`/admin/courses/${selectedCourseId}/clos`, { clos: cleaned });
    await load();
    alert("CLOs saved for this course");
  };

  const createTeacherUser = async (e) => {
    e.preventDefault();
    await api.post("/admin/users", {
      full_name: newUser.full_name,
      username: newUser.username,
      email: newUser.email,
      department: newUser.department || null,
      role: newUser.role,
      password: newUser.password,
    });

    alert(`User created (${newUser.role}). Default password: ${newUser.password}`);
    setNewUser({
      full_name: "",
      username: "",
      email: "",
      department: "",
      role: "instructor",
      password: "Teacher@12345",
    });
    await load();
  };

  // ============================
  // NEW: Edit existing user
  // ============================

  const saveEditedUser = async () => {
    if (!editUserId) {
      alert("Select a teacher first");
      return;
    }

    // basic client side checks
    if (!editForm.username.trim()) return alert("Username is required");
    if (!editForm.email.trim()) return alert("Email is required");

    const payload = {
      username: editForm.username.trim(),
      email: editForm.email.trim(),
      department: (editForm.department || "").trim() || null,
    };

    // password only sent if admin typed it
    if ((editForm.password || "").trim()) {
      payload.password = editForm.password.trim();
    }

    setSavingEdit(true);
    try {
      await api.put(`/admin/users/${editUserId}`, payload);
      alert("User updated successfully");
      setEditUserId("");
      setEditForm({ username: "", email: "", department: "", password: "" });
      await load();
    } finally {
      setSavingEdit(false);
    }
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div style={styles.page}>
      <div style={styles.headerCard}>
        <div style={styles.titleRow}>
          <h2 style={styles.h2}>Admin Panel</h2>
          <span style={styles.chip}>Role: {user?.role || "admin"}</span>
        </div>
        <p style={styles.hint}>
          Create courses, add teacher users, assign Instructor/Course Lead, and set course-specific CLOs.
        </p>
        {loading && (
          <div style={{ ...styles.small, marginTop: 8 }}>
            Loading admin data...
          </div>
        )}
      </div>

      {/* ========================= */}
      {/* Create teacher users (existing) */}
      {/* ========================= */}
      <div style={styles.card}>
        <div style={styles.titleRow}>
          <h3 style={styles.h3}>Create Teacher User</h3>
          <span style={styles.chip}>Default password allowed</span>
        </div>
        <p style={styles.hint}>
          Create Instructor/Course Lead accounts (they can log in and then be assigned to courses).
        </p>

        <form onSubmit={createTeacherUser} style={styles.grid}>
          <div style={styles.row}>
            <input
              style={styles.input}
              placeholder="Full Name"
              value={newUser.full_name}
              onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
              required
            />
            <select
              style={{ ...styles.select, width: 220 }}
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              <option value="instructor">Instructor</option>
              <option value="course_lead">Course Lead</option>
            </select>
          </div>

          <div style={styles.row}>
            <input
              style={styles.input}
              placeholder="Username (e.g. ali.instructor)"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              required
            />
            <input
              style={styles.input}
              placeholder="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              required
            />
          </div>

          <div style={styles.row}>
            <input
              style={styles.input}
              placeholder="Department (optional)"
              value={newUser.department}
              onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
            />
            <input
              style={styles.input}
              placeholder="Password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              required
            />
          </div>

          <button style={styles.btnPrimary} type="submit">
            Create Teacher
          </button>
        </form>
      </div>

      {/* ========================= */}
      {/* Create course (existing) */}
      {/* ========================= */}
      <div style={styles.card}>
        <h3 style={styles.h3}>Create Course</h3>
        <form onSubmit={createCourse} style={styles.grid}>
          <input
            style={styles.input}
            placeholder="Course Code (e.g. CS-401)"
            value={form.course_code}
            onChange={(e) => setForm({ ...form, course_code: e.target.value })}
            required
          />
          <input
            style={styles.input}
            placeholder="Course Name"
            value={form.course_name}
            onChange={(e) => setForm({ ...form, course_name: e.target.value })}
            required
          />
          <input
            style={styles.input}
            placeholder="Department"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            required
          />
          <div style={styles.row}>
            <input
              style={styles.input}
              placeholder="Semester"
              value={form.semester}
              onChange={(e) => setForm({ ...form, semester: e.target.value })}
            />
            <input
              style={styles.input}
              placeholder="Year"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
          </div>
          <button style={styles.btnPrimary} type="submit">
            Create Course
          </button>
        </form>
      </div>

      {/* ========================= */}
      {/* Assign staff (existing) */}
      {/* ========================= */}
      <div style={styles.card}>
        <h3 style={styles.h3}>Assign Staff</h3>

        <div style={styles.grid}>
          <select
            style={styles.select}
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
          >
            <option value="">Select course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.course_code} — {c.course_name}
              </option>
            ))}
          </select>

          <div style={styles.row}>
            <select
              style={styles.select}
              value={assign.instructorId}
              onChange={(e) => setAssign({ ...assign, instructorId: e.target.value })}
            >
              <option value="">Assign Instructor…</option>
              {instructors.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.username})
                </option>
              ))}
            </select>

            <select
              style={styles.select}
              value={assign.courseLeadId}
              onChange={(e) => setAssign({ ...assign, courseLeadId: e.target.value })}
            >
              <option value="">Assign Course Lead…</option>
              {courseLeads.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.username})
                </option>
              ))}
            </select>
          </div>

          <button style={styles.btnPrimary} onClick={assignStaff} type="button">
            Save Assignments
          </button>

          {selectedCourse ? (
            <div style={styles.small}>
              Selected: <b>{selectedCourse.course_code}</b> — {selectedCourse.course_name}
            </div>
          ) : null}
        </div>
      </div>

      {/* ========================= */}
      {/* Set CLOs (existing) */}
      {/* ========================= */}
      <div style={styles.card}>
        <div style={styles.titleRow}>
          <h3 style={styles.h3}>Set CLOs (Course-Specific)</h3>
          <span style={styles.chip}>Used in CLO Alignment</span>
        </div>
        <p style={styles.hint}>
          Select a course, then add CLOs. These are stored in <b>courses.clos</b> as JSON and used by alignment.
        </p>

        {/* ✅ Course selector INSIDE CLO section (existing) */}
        <select
          style={styles.select}
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
        >
          <option value="">Select course…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.course_code} — {c.course_name}
            </option>
          ))}
        </select>

        <div style={styles.divider} />

        {clos.map((c, idx) => (
          <div key={idx} style={{ ...styles.row, marginBottom: 8 }}>
            <input
              style={{ ...styles.input, width: 130 }}
              placeholder="CLO1"
              value={c.code}
              onChange={(e) => {
                const next = [...clos];
                next[idx] = { ...next[idx], code: e.target.value };
                setClos(next);
              }}
            />
            <input
              style={styles.input}
              placeholder="Description"
              value={c.description}
              onChange={(e) => {
                const next = [...clos];
                next[idx] = { ...next[idx], description: e.target.value };
                setClos(next);
              }}
            />
            <button
              style={styles.btn}
              onClick={() => setClos(clos.filter((_, i) => i !== idx))}
              type="button"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}

        <div style={styles.row}>
          <button
            style={styles.btn}
            type="button"
            onClick={() =>
              setClos([...clos, { code: `CLO${clos.length + 1}`, description: "" }])
            }
          >
            + Add CLO
          </button>
          <button style={styles.btnPrimary} type="button" onClick={saveClos}>
            Save CLOs
          </button>
        </div>

        <div style={{ ...styles.small, marginTop: 10 }}>
          Tip: Keep CLO code like <b>CLO1</b>, <b>CLO2</b>... and write meaningful descriptions.
        </div>
      </div>

      {/* ===================================================== */}
      {/* ✅ NEW FEATURE (ADD-ON ONLY): Edit Existing Teacher */}
      {/* ===================================================== */}
      <div style={styles.card}>
        <div style={styles.titleRow}>
          <h3 style={styles.h3}>Edit Teacher / Course Lead</h3>
          <span style={styles.chip}>Admin Only</span>
        </div>

        <p style={styles.hint}>
          Update username, email, department, or reset password for existing teachers.
        </p>

        <div style={styles.grid}>
          <select
            style={styles.select}
            value={editUserId}
            onChange={(e) => {
              const id = e.target.value;
              setEditUserId(id);

              const u = allTeachers.find((x) => x.id === id);
              if (u) {
                setEditForm({
                  username: u.username || "",
                  email: u.email || "",
                  department: u.department || "",
                  password: "",
                });
              } else {
                setEditForm({ username: "", email: "", department: "", password: "" });
              }
            }}
          >
            <option value="">Select Teacher…</option>
            {allTeachers.map((u) => (
              <option key={u.id} value={u.id}>
                {formatUserOption(u)}
              </option>
            ))}
          </select>

          <div style={styles.row}>
            <input
              style={styles.input}
              placeholder="Username"
              value={editForm.username}
              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
            />
            <input
              style={styles.input}
              placeholder="Email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
          </div>

          <div style={styles.row}>
            <input
              style={styles.input}
              placeholder="Department"
              value={editForm.department}
              onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
            />
            <input
              style={styles.input}
              type="password"
              placeholder="New Password (optional)"
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
            />
          </div>

          <div style={styles.row}>
            <button
              style={styles.btnPrimary}
              onClick={saveEditedUser}
              type="button"
              disabled={savingEdit}
              title="Saves username/email/department and password if provided"
            >
              {savingEdit ? "Saving..." : "Save Changes"}
            </button>

            <button
              style={styles.btn}
              type="button"
              onClick={() => {
                setEditUserId("");
                setEditForm({ username: "", email: "", department: "", password: "" });
              }}
              disabled={savingEdit}
            >
              Clear
            </button>
          </div>

          <div style={styles.small}>
            Password reset is optional. If you leave it empty, password will remain unchanged.
          </div>
        </div>
      </div>
    </div>
  );
}
