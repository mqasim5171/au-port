// src/components/CLOAlignment.js
import React, { useState } from "react";
import '../App.css';


const CLOAlignment = () => {
  const [selectedCourse, setSelectedCourse] = useState("");
  const [cloData, setCloData] = useState([
    {
      id: 1,
      clo: "CLO-1: Understand fundamentals of Programming",
      alignments: { PLO1: true, PLO2: false, PLO3: true },
    },
    {
      id: 2,
      clo: "CLO-2: Apply OOP concepts in problem-solving",
      alignments: { PLO1: false, PLO2: true, PLO3: true },
    },
  ]);

  const courses = [
    { id: "c1", code: "CS101", name: "Programming Fundamentals" },
    { id: "c2", code: "CS202", name: "Data Structures" },
  ];

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">CLO-PLO Alignment</h1>
        <p className="page-subtitle">
          Map Course Learning Outcomes (CLOs) with Program Learning Outcomes
          (PLOs)
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Select Course</h2>
        </div>
        <div className="card-content">
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="form-input"
            style={{ marginBottom: "16px" }}
          >
            <option value="">Choose a course...</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} - {course.name}
              </option>
            ))}
          </select>

          {selectedCourse && (
            <div className="alignment-table">
              <table className="styled-table">
                <thead>
                  <tr>
                    <th>CLOs</th>
                    <th>PLO 1</th>
                    <th>PLO 2</th>
                    <th>PLO 3</th>
                  </tr>
                </thead>
                <tbody>
                  {cloData.map((clo) => (
                    <tr key={clo.id}>
                      <td>{clo.clo}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={clo.alignments.PLO1}
                          readOnly
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={clo.alignments.PLO2}
                          readOnly
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={clo.alignments.PLO3}
                          readOnly
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CLOAlignment;
