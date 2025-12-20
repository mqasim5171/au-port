import React, { useEffect, useMemo, useState } from "react";
import api from "../api";

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

  // ✅ NEW: Create Teacher User form
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

    if (!selectedCourseId && cList.length) setSelectedCourseId(cList[0].id);
  };

  useEffect(() => {
    if (!isAdmin) return;
    load().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="card">
        <h2>Admin</h2>
        <p style={{ opacity: 0.8 }}>You do not have access to this page.</p>
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
    await api.put(`/admin/courses/${selectedCourseId}/clos`, {
      clos: clos.filter((c) => c.code && c.description),
    });
    alert("CLOs saved");
  };

  // ✅ NEW: create teacher user (instructor / course lead)
  const createTeacherUser = async (e) => {
    e.preventDefault();
    await api.post("/admin/users", {
      full_name: newUser.full_name,
      username: newUser.username,
      email: newUser.email,
      department: newUser.department || null,
      role: newUser.role,         // "instructor" | "course_lead"
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
    await load(); // refresh dropdowns
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card">
        <h2 style={{ marginBottom: 8 }}>Admin Panel</h2>
        <p style={{ opacity: 0.8 }}>
          Create courses, add teacher users, assign Instructor/Course Lead, and set CLOs.
        </p>
      </div>

      {/* ✅ NEW: Create teacher users */}
      <div className="card">
        <h3>Create Teacher User</h3>
        <p style={{ opacity: 0.75 }}>
          Create Instructor/Course Lead accounts (they can log in and then be assigned to courses).
        </p>

        <form onSubmit={createTeacherUser} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              style={{ flex: 1 }}
              placeholder="Full Name"
              value={newUser.full_name}
              onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
              required
            />
            <select
              style={{ width: 220 }}
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            >
              <option value="instructor">Instructor</option>
              <option value="course_lead">Course Lead</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <input
              style={{ flex: 1 }}
              placeholder="Username (e.g. ali.instructor)"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              required
            />
            <input
              style={{ flex: 1 }}
              placeholder="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              required
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <input
              style={{ flex: 1 }}
              placeholder="Department (optional)"
              value={newUser.department}
              onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
            />
            <input
              style={{ flex: 1 }}
              placeholder="Password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              required
            />
          </div>

          <button className="btn-primary" type="submit">
            Create Teacher
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Create Course</h3>
        <form onSubmit={createCourse} style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="Course Code (e.g. CS101)"
            value={form.course_code}
            onChange={(e) => setForm({ ...form, course_code: e.target.value })}
            required
          />
          <input
            placeholder="Course Name"
            value={form.course_name}
            onChange={(e) => setForm({ ...form, course_name: e.target.value })}
            required
          />
          <input
            placeholder="Department"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            required
          />
          <div style={{ display: "flex", gap: 10 }}>
            <input
              placeholder="Semester"
              value={form.semester}
              onChange={(e) => setForm({ ...form, semester: e.target.value })}
            />
            <input
              placeholder="Year"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
            />
          </div>
          <button className="btn-primary" type="submit">
            Create
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Assign Staff</h3>

        <div style={{ display: "grid", gap: 10 }}>
          <select
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

          <div style={{ display: "flex", gap: 10 }}>
            <select
              value={assign.instructorId}
              onChange={(e) => setAssign({ ...assign, instructorId: e.target.value })}
              style={{ flex: 1 }}
            >
              <option value="">Assign Instructor…</option>
              {instructors.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.username})
                </option>
              ))}
            </select>

            <select
              value={assign.courseLeadId}
              onChange={(e) => setAssign({ ...assign, courseLeadId: e.target.value })}
              style={{ flex: 1 }}
            >
              <option value="">Assign Course Lead…</option>
              {courseLeads.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.username})
                </option>
              ))}
            </select>
          </div>

          <button className="btn-primary" onClick={assignStaff}>
            Save Assignments
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Set CLOs</h3>
        <p style={{ opacity: 0.75 }}>
          Add CLOs for the selected course (used later for CLO alignment + assessment checks).
        </p>

        {clos.map((c, idx) => (
          <div key={idx} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <input
              style={{ width: 120 }}
              placeholder="CLO1"
              value={c.code}
              onChange={(e) => {
                const next = [...clos];
                next[idx] = { ...next[idx], code: e.target.value };
                setClos(next);
              }}
            />
            <input
              style={{ flex: 1 }}
              placeholder="Description"
              value={c.description}
              onChange={(e) => {
                const next = [...clos];
                next[idx] = { ...next[idx], description: e.target.value };
                setClos(next);
              }}
            />
            <button onClick={() => setClos(clos.filter((_, i) => i !== idx))} type="button">
              X
            </button>
          </div>
        ))}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() =>
              setClos([...clos, { code: `CLO${clos.length + 1}`, description: "" }])
            }
          >
            + Add CLO
          </button>
          <button className="btn-primary" type="button" onClick={saveClos}>
            Save CLOs
          </button>
        </div>
      </div>
    </div>
  );
}
