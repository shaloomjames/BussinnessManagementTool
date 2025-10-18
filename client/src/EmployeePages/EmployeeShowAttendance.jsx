import React, { useState, useEffect } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import "./employee.css";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

const EmployeeShowAttendance = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const currentDate = new Date();
    return currentDate.toISOString().slice(0, 7); // YYYY-MM
  });
  const [id, setId] = useState("");
  const [attendanceReport, setAttendanceReport] = useState(null);
  const [loading, setLoading] = useState(false); // Added for loading feedback

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10); // Removed setPageSize as it's unused
  const [totalPages, setTotalPages] = useState(0);

    const navigate = useNavigate();

    // Secure page
    useEffect(() => {
      const userToken = Cookies.get("UserAuthToken");
      if (!userToken) {
        navigate("/login");
        return;
      }

      try {
        const decodedToken = jwtDecode(userToken);
        const userRole = decodedToken.userrole;
        setId(decodedToken.userid);
        if (
          !(Array.isArray(userRole) && userRole.includes("Employee")) &&
          userRole !== "Employee"
        ) {
          navigate("/login");
        }
      } catch (error) {
        console.error("Token decoding failed:", error);
        navigate("/login");
      }
    }, [navigate]);

  // Handle showing errors
  const showErrorAlert = (message) => {
    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: message,
    });
  };

  // Fetch attendance records
  useEffect(() => {
    if (!id) return;

    const fetchAttendanceData = async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/attendance/${id}`
        );
        setAttendanceData(response.data);
        setAttendanceRecords(response.data); // Set both for immediate render
      } catch (error) {
        console.error("Error fetching attendance data:", error);
        showErrorAlert(
          error.response?.data?.err || "Error Fetching Attendance Records"
        );
      } finally {
        setLoading(false);
      }
    };
    fetchAttendanceData();
  }, [id]);

  // Filter attendance records by month
  useEffect(() => {
    const filteredRecords = attendanceData.filter((record) =>
      new Date(record.attendanceDate).toISOString().slice(0, 7) === selectedMonth
    );
    setAttendanceRecords(filteredRecords);
    setPage(1); // Reset to first page
  }, [attendanceData, selectedMonth]);

  // Update pagination
  useEffect(() => {
    const newTotal = Math.ceil(attendanceRecords.length / pageSize) || 1; // Minimum 1 page
    setTotalPages(newTotal);
    if (page > newTotal) setPage(newTotal);
  }, [attendanceRecords, pageSize, page]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  // Fetch attendance report
  const fetchAttendanceReport = async () => {
    if (!id || !selectedMonth) return;

    setLoading(true);
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/attendance/report/${id}/${selectedMonth}`
      );
      setAttendanceReport(response.data);
    } catch (error) {
      console.error("Error fetching attendance report:", error);
      showErrorAlert(
        error.response?.data?.err || "Error Fetching Attendance Report"
      );
    } finally {
      setLoading(false);
    }
  };

  // Reset attendance report when month changes
  useEffect(() => {
    setAttendanceReport(null);
  }, [selectedMonth]);

  // Pagination slice
  const startIndex = (page - 1) * pageSize;
  const endIndex = page * pageSize;
  const currentData = attendanceRecords.slice(startIndex, endIndex);

  return (
    <div className="container-fluid mt-3">
      {/* Month Picker & Generate Report Button */}
      <div className="row my-1">
        <div className="col-lg-12">
          <div className="card">
            <div className="card-body">
              <div className="row filters">
                <div className="col-lg-3">
                  <label>Select Month</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="form-control"
                  />
                </div>
                <div className="col-lg-2 d-flex align-items-end">
                  <button
                    style={{
                      whiteSpace: "normal",
                      textAlign: "center",
                      wordWrap: "break-word",
                    }}
                    onClick={fetchAttendanceReport}
                    className="btn btn-primary mt-3 w-100"
                    disabled={attendanceRecords.length === 0 || loading}
                  >
                    {loading ? "Generating..." : "Generate Report"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Report Details */}
      {attendanceReport && (
        <div className="row my-1">
          <div className="col-lg-12">
            <div class="card">
              <div class="card-body">
                <div className="d-flex justify-content-end">
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => setAttendanceReport(null)}
                    title="Close report"
                  >
                    <i className="fa fa-times"></i>
                  </button>
                </div>
                <div className="table-responsive">
                  <h4>
                    Attendance Summary for{" "}
                    {attendanceReport?.reportMonth || "N/A"}
                  </h4>
                  <table className="table header-border">
                    <thead>
                      <tr>
                        <th>Total Days In Month</th>
                        <th>Total Weekends in Month</th>
                        <th>Working Days (Excl. Sundays)</th>
                        <th>Days On Time</th>
                        <th>Days Late</th>
                        <th>On Holiday</th>
                        <th>On Leave</th>
                        <th>Absent Days (Excl. Sundays)</th>
                        <th>Effective Absents (From Lates)</th>
                        <th>Effective Lates Left</th>
                        <th>Total Absents</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{attendanceReport.totalDays || 0}</td>
                        <td>{attendanceReport.totalWeekends || 0}</td>
                        <td>{attendanceReport.workingDays || 0}</td>
                        <td>{attendanceReport.daysOnTime || 0}</td>
                        <td>{attendanceReport.daysLate || 0}</td>
                        <td>{attendanceReport.Holiday || 0}</td>
                        <td>{attendanceReport.OnLeave || 0}</td>
                        <td>{attendanceReport.absentDays || 0}</td>
                        <td>{attendanceReport.effectiveAbsentDays || 0}</td>
                        <td>{attendanceReport.remainingLates || 0}</td>
                        <td>{attendanceReport.totalAbsentDays || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Records */}
      <div className="row mb-5">
        <div className="col-lg-12">
          <div className="card p-4 mb-5">
            <div className="mt-4">
              <h3>Attendance Records</h3>
              {loading ? (
                <p className="text-center">Loading attendance records...</p>
              ) : (
                <>
                  {/* Pagination Controls */}
                  {attendanceRecords.length > pageSize && (
                    <div className="mt-5 mb-2 d-flex justify-content-end">
                      <button
                        className="btn mx-2 btn-sm"
                        onClick={() => handlePageChange(1)}
                        disabled={page <= 1}
                      >
                        First
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page <= 1}
                      >
                        Prev
                      </button>
                      <span className="mx-2">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        className="btn btn-sm"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page >= totalPages}
                      >
                        Next
                      </button>
                      <button
                        className="btn mx-2 btn-sm"
                        onClick={() => handlePageChange(totalPages)}
                        disabled={page >= totalPages}
                      >
                        Last
                      </button>
                    </div>
                  )}
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Employee Name</th>
                        <th>Date</th>
                        <th>Time In</th>
                        <th>Time Out</th>
                        <th>Status</th>
                        <th>Late By (minutes)</th>
                        <th>Total Hours Worked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentData.length > 0 ? (
                        currentData.map((record,index) => (
                          <tr key={record._id}>
                            <td>{startIndex + index + 1}</td>{" "}
                            <td>{record?.employee?.employeeName || "N/A"}</td>
                            <td>
                              {record?.attendanceDate
                                ? new Date(
                                    record.attendanceDate
                                  ).toLocaleString()
                                : "N/A"}
                            </td>
                            <td>
                              {record.timeIn
                                ? new Date(record.timeIn).toLocaleTimeString()
                                : "-" }
                            </td>
                            <td>
                              {record.timeOut
                                ? new Date(record.timeOut).toLocaleTimeString()
                                :  "-"}
                            </td>
                            <td>
                              <i
                                className={`fa fa-circle-o text-${
                                  record?.status === "Late"
                                    ? "warning"
                                    : "success"
                                } me-2`}
                              ></i>
                              {record?.status || "N/A"}
                            </td>
                            <td>{record?.lateBy || 0}</td>
                            <td>{record?.totalHours?.toFixed(2) || 0}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="text-center">
                            No attendance records found for{" "}
                            {new Date(`${selectedMonth}-01`).toLocaleString(
                              "default",
                              { month: "long", year: "numeric" }
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {/* Pagination Controls */}
                  {attendanceRecords.length > pageSize && (
                    <div className="d-flex justify-content-end mt-3">
                      <button
                        className="btn mx-2 btn-sm"
                        onClick={() => handlePageChange(1)}
                        disabled={page <= 1}
                      >
                        First
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page <= 1}
                      >
                        Prev
                      </button>
                      <span className="mx-2">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        className="btn btn-sm"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page >= totalPages}
                      >
                        Next
                      </button>
                      <button
                        className="btn mx-2 btn-sm"
                        onClick={() => handlePageChange(totalPages)}
                        disabled={page >= totalPages}
                      >
                        Last
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeShowAttendance;