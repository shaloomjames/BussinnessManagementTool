const moment = require("moment");
const AttendanceModel = require("../models/AttendanceModel");
const  EmployeeModel = require("../models/EmployeeModel");
const mongoose = require("mongoose");
const HolidayModel = require("../models/HolidayModel");
const LeaveModel = require("../models/LeaveModel");


const getAttendanceReport = async (req, res) => {
  const { employeeId, month } = req.params; // Ex: 2024-12 for December

  // Validate month format (YYYY-MM)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ err: "Invalid month format. Use YYYY-MM (e.g., 2024-12)." });
  }

  // Validate employeeId (assuming it's a MongoDB ObjectId)
  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    return res.status(400).json({ err: "Invalid employee ID format." });
  }

  // Set the start and end date of the month
  const startDate = moment(`${month}-01`).startOf("month");
  const endDate = moment(startDate).endOf("month");

  const totalDays = endDate.date(); // Total days in the month (e.g., 31 for December)

  try {
    // Fetch all attendance records for the employee within the selected month
    const attendanceLogs = await AttendanceModel.find({
      employee: employeeId,
      attendanceDate: { $gte: startDate.toDate(), $lte: endDate.toDate() },
    }).populate("employee");

    // Check if no attendance records exist
    if (attendanceLogs.length === 0) {
      const employee = await EmployeeModel.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          err: `Employee with ID ${employeeId} not found.`,
        });
      }
      return res.status(404).json({
        err: `No attendance records were found for ${employee.employeeName} for the month of ${moment(startDate).format("MMMM YYYY")}.`,
      });
    }

    // Calculate days based on attendance status
    const daysLate = attendanceLogs.filter((log) => log.status === "Late").length;
    const daysOnTime = attendanceLogs.filter((log) => log.status === "On Time").length;
    const Holiday = attendanceLogs.filter((log) => log.status === "Holiday").length;
    const OnLeave = attendanceLogs.filter((log) => log.status === "On Leave").length;
    const absentDays = attendanceLogs.filter((log) => log.status === "Absence").length;

    // Calculate total weekends (Sundays + even Saturdays)
    let totalSundays = 0;
    let totalSaturdays = 0;
    let workingSaturdays = 0; // Odd Saturdays
    let weekendSaturdays = 0; // Even Saturdays
    for (let date = startDate.clone(); date.isSameOrBefore(endDate); date.add(1, "day")) {
      if (date.day() === 0) { // Sunday
        totalSundays++;
      } else if (date.day() === 6) { // Saturday
        
        const saturdayNumber = Math.ceil(date.date() / 7); // Calculate the "nth Saturday" like the first code
        totalSaturdays++;
        if (saturdayNumber % 2 === 0) {
          weekendSaturdays++; // Even Saturdays are weekends
        } else {
          workingSaturdays++; // Odd Saturdays are working days
        }
      }
    }
    const totalWeekends = totalSundays + weekendSaturdays; // Sundays + even Saturdays

    // Calculate working days (total days minus weekends)
    const workingDays = totalDays - totalWeekends;

    // Total days with attendance records
    const totalAttendanceRecordDays = attendanceLogs.length;

    // Handle late-to-absent conversion
    const calculateAbsentDays = (lates) => {
      let effectiveAbsentDays = Math.floor(lates / 3); // 3 lates = 1 absent day
      let remainingLates = lates % 3; // Remaining late days
      return { effectiveAbsentDays, remainingLates };
    };
    const { effectiveAbsentDays, remainingLates } = calculateAbsentDays(daysLate);

    // Combine absences and cap at working days
    const totalAbsentDays = Math.min(absentDays + effectiveAbsentDays, workingDays);

    // Send the response
    res.status(200).json({
      employee: attendanceLogs[0]?.employee, // Employee data from populated model
      reportMonth: month,
      totalDays,            // Total days in the month
      totalWeekends,        // Total weekends (Sundays + even Saturdays)
      workingDays,          // Total working days (excluding weekends)
      absentDays,           // Days explicitly marked as "Absence"
      daysLate,             // Total late days
      daysOnTime,           // Total on-time days
      Holiday,              // Total holiday days 
      OnLeave,              // Total leave days
      effectiveAbsentDays,  // Absent days from late conversion
      remainingLates,       // Late days left after conversion
      totalAttendanceRecordDays, // Total days with any attendance log
      totalAbsentDays,      // Final total absent days (capped)
    });
  } catch (error) {
    console.error("Error generating attendance report:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
};

// @Request   GET
// @Route     http://localhost:5000/api/attendance
// @Access    Private for admin
const getAttendance = async (req, res) => {
    try {
        const Attendance = await AttendanceModel.find().populate("employee");

        if (!Attendance.length) return res.status(404).json({ err: "No Data Found" });

        return res.status(200).json(Attendance)
    } catch (error) {
        console.log("Error Reading Attendance", error);
        return res.status(500).json({ err: "Internal Server Error", error: error.message });
    }
}

const getAttendanceByEmployeeId = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Fetching attendance for employee ID: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ err: "Invalid employee ID" });
    }

    const attendanceRecords = await AttendanceModel.find({ employee: id }).populate("employee");
    console.log(`Found ${attendanceRecords.length} records`);

    if (!attendanceRecords.length) {
      return res.status(404).json({ err: "No attendance records found" });
    }

    return res.status(200).json(attendanceRecords);
  } catch (error) {
    console.error("Error fetching attendance records:", error.message);
    if (error.name === "MongoServerSelectionError") {
      return res.status(503).json({ message: "Database temporarily unavailable, please try again later" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

// @Request   GET
// @Route     http://localhost:5000/api/attendance
// @Access    Private
const getSingleAttendance = async (req, res) => {
  try {
      const employee = req.params.id;
      const attendanceDate = req.params.date;
      if (!mongoose.Types.ObjectId.isValid(employee)) return res.status(400).json({ err: "Invalid ID Format" });

      const Attendance = await AttendanceModel.findOne({employee,attendanceDate}).populate("employee");
      if (!Attendance) return res.status(404).json({ err: "No Data Found" });

      return res.status(200).json(Attendance)
  } catch (error) {
      console.log("Error Reading Attendance", error);
      return res.status(500).json({ err: "Internal Server Error", error: error.message });
  }
}



// @Request   POST
// @Route     http://localhost:5000/api/attendance
// @Access    Private
const createAttendance = async (req, res) => {
  try {
    const { employee, attendanceDate, timeIn, status, lateBy, totalHours } = req.body;

    if (!employee) return res.status(400).json({ err: "Employee ID is required." });
    if (!timeIn) return res.status(400).json({ err: "Check-in time is required." });
    
      // Check for existing attendance record for the employee on the same day
      const existingAttendance = await AttendanceModel.findOne({ employee, attendanceDate });
      if (existingAttendance) {
        return res.status(400).json({ err: "Attendance already marked for today." });
      }

      const holiday = await HolidayModel.findOne({ date: attendanceDate });
      if(holiday) return res.status(400).json({err:"You cannot mark attendance. Today is a holiday"});

      const leave = await LeaveModel.findOne({ employee, startDate: { $gte: new Date(attendanceDate), $lte: new Date(attendanceDate) } });
      if(leave) return res.status(400).json({err:"You cannot mark attendance. You are on leave"});

       // Validate if the attendance date is a weekend (even Saturday or Sunday)
    const date = new Date(attendanceDate);
    const dayOfWeek = date.getDay(); // Get the day of the week (0 = Sunday, 6 = Saturday)

    // Check if the date is a Sunday (dayOfWeek === 0) or an even Saturday
    if (dayOfWeek === 0) { // It's a Sunday
      return res.status(400).json({ err: "You cannot mark attendance on a Sunday. It is a weekend." });
    }

    if (dayOfWeek === 6) { // It's a Saturday
      const saturdayNumber = Math.ceil(date.getDate() / 7); // Get the Saturday number of the month (1st, 2nd, etc.)
      
      // If it's an even Saturday, prevent attendance marking
      if (saturdayNumber % 2 === 0) {
        return res.status(400).json({ err: "You cannot mark attendance on an even Saturday. It is a weekend." });
      }
    }


    const timeInDate = new Date(timeIn);

    const attendance = await AttendanceModel.create({
      employee,
      attendanceDate: new Date(attendanceDate || Date.now()),
      timeIn: timeInDate,
      
      status: status || "On Time",
      lateBy: lateBy || 0,
      totalHours: totalHours || 0,
    });

    return res.status(201).json({ msg: "Attendance added successfully", attendance });
  } catch (error) {
    console.error("Error creating attendance:", error);
    return res.status(500).json({ err: "Internal Server Error", error: error.message });
  }
};


// @Request   PUT
// @Route     http://localhost:5000/api/attendance/:id
// @Access    Private
const updateAttendance = async (req, res) => {
  try {
    const { timeOut } = req.body;

    const attendance = await AttendanceModel.findById(req.params.id);
    if (!attendance) return res.status(404).json({ err: "Attendance not found." });

    if (timeOut) {
      const timeOutDate = new Date(timeOut);
      const totalHours = (timeOutDate - new Date(attendance.timeIn)) / (1000 * 60 * 60);

      attendance.timeOut = timeOutDate;
      attendance.totalHours = totalHours;
    }

    await attendance.save();

    return res.status(200).json({ msg: "Attendance updated successfully", attendance });
  } catch (error) {
    console.error("Error updating attendance:", error);
    return res.status(500).json({ err: "Internal Server Error", error: error.message });
  }
};

module.exports = {getAttendance,getSingleAttendance,getAttendanceByEmployeeId, createAttendance, updateAttendance ,getAttendanceReport};