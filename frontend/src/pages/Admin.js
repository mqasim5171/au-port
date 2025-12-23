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
  titleRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  h2: { margin: 0, fontSize: 22 },
  h3: { margin: 0, fontSize: 18 },
  hint: { marginTop: 6, opacity: 0.75, lineHeight: 1.4 },
  grid: { display: "grid", gap: 10 },
  row: { display: "flex", gap: 10, alignItems: "center" },
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
  },
  divider: { height: 1, background: "#e5e7eb", margin: "12px 0" },
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

export default function Admin({ user }) {
  const isAdmin = useMemo(
    () => (user?.role || "").toLowerCase().includes("admin"),
    [user]
  );

  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [courseLeads, setCourseLeads] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");

  const [form, setForm] = useState({
    course_code: "",
    course_name: "",
    semester: "Fall",
    year: "2025",
    department: "",
  });

  const [clos, setClos] = useState([{ code: "CLO1", description: "" }]);
  const [assign, setAssign] = useState({ instructorId: "", courseLeadId: "" });

  // ✅ Create Teacher User form
  const [newUser, setNewUser] = useState({
    full_name: "",
    username: "",
    email: "",
    department: "",
    role: "instructor",
    password: "Teacher@12345",
  });

  const load = async () => {
    const [cRes, iRes, lRes] = await Promise.all([
      api.get("/courses"),
      api.get("/admin/users?role=instructor"),
      api.get("/admin/users?role=course_lead"),
    ]);

    const cList = cRes.data || [];
    setCourses(cList);
    setInstructors(iRes.data || []);
    setCourseLeads(lRes.data || []);

    if (!selectedCourseId && cList.length) {
      setSelectedCourseId(cList[0].id);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    load().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // ✅ When selected course changes, load its CLOs from courses list
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

  const createCourse = async (e) => {
    e.preventDefault();
    await api.post("/admin/courses", {
      ...form,
      instructor: "",
      clos: "[]",
    });
    await load();
    alert("Course created");
    setForm({ course_code: "", course_name: "", semester: "Fall", year: "2025", department: "" });
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
      .map((c) => ({ code: (c.code || "").trim(), description: (c.description || "").trim() }))
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
      </div>

      {/* Create teacher users */}
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

      {/* Create course */}
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

      {/* Assign staff */}
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

          <button style={styles.btnPrimary} onClick={assignStaff}>
            Save Assignments
          </button>
        </div>
      </div>

      {/* Set CLOs */}
      <div style={styles.card}>
        <div style={styles.titleRow}>
          <h3 style={styles.h3}>Set CLOs (Course-Specific)</h3>
          <span style={styles.chip}>Used in CLO Alignment</span>
        </div>
        <p style={styles.hint}>
          Select a course, then add CLOs. These are stored in <b>courses.clos</b> as JSON and used by alignment.
        </p>

        {/* ✅ Course selector INSIDE CLO section (you asked this) */}
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
            onClick={() => setClos([...clos, { code: `CLO${clos.length + 1}`, description: "" }])}
          >
            + Add CLO
          </button>
          <button style={styles.btnPrimary} type="button" onClick={saveClos}>
            Save CLOs
          </button>
        </div>
      </div>
    </div>
  );
}
