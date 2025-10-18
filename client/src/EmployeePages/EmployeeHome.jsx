import React, { useEffect, useState } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import Cookies from "js-cookie";
import Swal from "sweetalert2";
import "./employee.css";
import { useNavigate } from "react-router-dom";

const EmployeeHome = () => {
  const [currentDate, setCurrentDate] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [Id, setId] = useState("");
  const [employeeId, setemployeeId] = useState("");
  const [InTime, setInTime] = useState("");
  const [OutTime, setOutTime] = useState("");
  // Loading states
  const [isLoadingCheckIn, setIsLoadingCheckIn] = useState(false);
  const [isLoadingCheckOut, setIsLoadingCheckOut] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  const navigate = useNavigate();

  const showErrorAlert = (message) => {
    Swal.fire({ icon: 'error', title: 'Oops...', text: message });
  };

  const showSuccessAlert = (message) => {
    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: message,
      timer: 2000,
      showConfirmButton: false,
    });
  };

  // secure page
  useEffect(() => {
    const userToken = Cookies.get("UserAuthToken");
    if (userToken) {
      try {
        const decodedToken = jwtDecode(userToken);
        const userRole = decodedToken.userrole;
        setId(decodedToken.userid);
        setemployeeId(decodedToken.user_employeeId);
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
    } else {
      navigate("/login");
    }
  }, [navigate]);

  const formatDate = (date) => date.toISOString().split("T")[0];
  const formatTime = (date) => date.toTimeString().split(" ")[0].slice(0, 5);

  const getMinutesLate = (currentTime, targetTime) => {
    const [currentHours, currentMinutes] = currentTime.split(":").map(Number);
    const [targetHours, targetMinutes] = targetTime.split(":").map(Number);
    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    const targetTotalMinutes = targetHours * 60 + targetMinutes;
    return Math.max(0, currentTotalMinutes - targetTotalMinutes);
  };

  // useEffect(() => {
  //   const today = new Date();
  //   setCurrentDate(formatDate(today));
  // }, []);
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set time to midnight (00:00:00.000)
    setCurrentDate(formatDate(today));
  }, []);

  useEffect(() => {
    const fetchCurrentAttendance = async () => {
      setIsLoadingStatus(true);
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/attendance/${Id}/${currentDate}`);
        setAttendanceStatus(res?.data || null);
      } catch (error) {
        console.error("Failed to fetch current attendance:", error);
      } finally {
        setIsLoadingStatus(false);
      }
    };
  
    if (Id && currentDate) fetchCurrentAttendance();
  }, [Id, currentDate]);

  const markCheckIn = async () => {
    setIsLoadingCheckIn(true);
    try {
      const now = new Date();
      const currentTime = formatTime(now);
      const lateBy = currentTime > InTime ? getMinutesLate(currentTime, InTime) : 0;
      const userToken = Cookies.get("UserAuthToken");
      if (!userToken) throw new Error("User not authenticated.");

      const decodedToken = jwtDecode(userToken);
      const userId = decodedToken.userid;
      
      const attendance = {
        employee: userId,
        attendanceDate: currentDate,
        timeIn: now.toISOString(),
        status: lateBy > 0 ? "Late" : "On Time",
        lateBy,
        employeeId: employeeId
      };

      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/attendance`, attendance);
      setAttendanceStatus(response.data.attendance);
      showSuccessAlert(response?.data?.msg || "Check-In successful");
    } catch (error) {
      console.error("Error during Check-In:", error.response?.data || error.message);
      showErrorAlert(error.response?.data?.err || "Failed to add Attendance");
    } finally {
      setIsLoadingCheckIn(false);
    }
  };

  const markCheckOut = async () => {
    setIsLoadingCheckOut(true);
    try {
      const now = new Date();
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/api/attendance/${attendanceStatus._id}`,
        { timeOut: now.toISOString() }
      );
      setAttendanceStatus(response.data.attendance);
      showSuccessAlert(response?.data?.msg || "Check-Out successful");
    } catch (error) {
      showErrorAlert(error.response?.data?.err || "Failed to add Attendance");
      console.error("Error during Check-Out:", error.response?.data || error.message);
    } finally {
      setIsLoadingCheckOut(false);
    }
  };

  return (
    <div className="container mt-5">
      <center className="card py-5">
        <div className="row">
          <div className="col-lg-12 text-center">
            <h2>Attendance Tracker</h2>
            <p>Mark your attendance for the day.</p>
            <p>Date: {currentDate}</p>
          </div>

          <div className="row mt-4" style={{ width: "100vw", display: "flex", justifyContent: "space-between" }}>
            <div className="col-md-6 mt-2">
              <button 
                onClick={markCheckIn} 
                disabled={!!attendanceStatus || isLoadingCheckIn}
                className="btn btn-success"
              >
                {isLoadingCheckIn ? "Loading..." : "Check-In"}
              </button>
            </div>
            <div className="col-md-6 mt-2">
              <button 
                onClick={markCheckOut} 
                disabled={!attendanceStatus || !!attendanceStatus.timeOut || isLoadingCheckOut}
                className="btn btn-primary"
              >
                {isLoadingCheckOut ? "Loading..." : "Check-Out"}
              </button>
            </div>
          </div>

          <div className="mt-3" style={{ width: "100vw", display: "flex", flexDirection: "column" }}>
            {isLoadingStatus ? (
              <p>Loading status...</p>
            ) : attendanceStatus ? (
              <>
                <p>
                  <span style={{ fontWeight: "900" }}>Status:</span> {attendanceStatus.status}
                </p>
                <p>
                  <span style={{ fontWeight: "900" }}>Check-In:</span>{" "}
                  {new Date(attendanceStatus.timeIn).toLocaleTimeString()}
                </p>
                {attendanceStatus.timeOut && (
                  <p>
                    <span style={{ fontWeight: "900" }}>Check-Out:</span>{" "}
                    {new Date(attendanceStatus.timeOut).toLocaleTimeString()}
                  </p>
                )}
              </>
            ) : (
              <p>Attendance Not Marked yet</p>
            )}
          </div>
        </div>
      </center>
    </div>
  );
};

export default EmployeeHome;