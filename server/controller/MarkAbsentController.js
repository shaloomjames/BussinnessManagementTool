// Import necessary modules (assuming they are available in the project)
const moment = require("moment");
const mongoose = require("mongoose");
const EmployeeModel = require("../models/EmployeeModel");
const AttendanceModel = require("../models/AttendanceModel");
const HolidayModel = require("../models/HolidayModel");
const LeaveModel = require("../models/LeaveModel");

// Mark Absences for a Specific Date
// @Request   POST
// @Route     /api/attendance/mark-absences
// @Access    Private (Admin only)
const markAbsencesForDate = async (req, res) => {
  try {
    // Extract date from request body
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ err: "Date is required" });
    }

    // Parse and validate the date
    const targetDate = moment(date, "YYYY-MM-DD");
    if (!targetDate.isValid()) {
      return res
        .status(400)
        .json({ err: "Invalid date format. Use YYYY-MM-DD" });
    }

    // Prevent marking absences for future dates
    const today = moment().startOf("day");
    if (targetDate.isAfter(today)) {
      return res
        .status(400)
        .json({ err: "Cannot mark absences for future dates" });
    }

    // Check if the date is a Sunday (day 0)
    if (targetDate.day() === 0) {
      return res
        .status(400)
        .json({
          err: "The specified date is a Sunday, which is not a working day",
        });
    }

    // Check if the date is a holiday
    const holiday = await HolidayModel.findOne({ date: targetDate.toDate() });
    if (holiday) {
      return res.status(400).json({ err: "The specified date is a holiday" });
    }

    // Determine if the date is an off Saturday (alternate Saturdays)
    // For simplicity, assume alternate Saturdays are off, starting from a reference date
    // Reference: First Saturday of 2023 (2023-01-07) is a working day, then alternate
    const referenceDate = moment("2023-01-07", "YYYY-MM-DD");
    const weeksDiff = targetDate.diff(referenceDate, "weeks");
    const isSaturday = targetDate.day() === 6;
    const isOffSaturday = isSaturday && weeksDiff % 2 === 1; // Odd weeks are off

    if (isOffSaturday) {
      return res
        .status(400)
        .json({
          err: "The specified date is an off Saturday, which is not a working day",
        });
    }

    // If we reach here, the date is a working day
    // Fetch all employees
    const employees = await EmployeeModel.find();
    let absenceCount = 0;

    // Process each employee
    for (const employee of employees) {
      // Check if an attendance record exists for this employee on the target date
      const attendance = await AttendanceModel.findOne({
        employee: employee._id,
        attendanceDate: targetDate.toDate(),
      });

      // If no attendance record exists, mark as absent
      if (!attendance) {
        await AttendanceModel.create({
          employee: employee._id,
          attendanceDate: targetDate.toDate(),
          status: "Absence",
          timeIn: null,
          timeOut: null,
          lateBy: 0,
          totalHours: 0,
        });
        absenceCount++;
      }
    }

    // Return success response
    return res.status(200).json({
      msg: `Absences marked successfully. ${absenceCount} absence records created.`,
    });
  } catch (error) {
    console.error("Error marking absences:", error);
    return res
      .status(500)
      .json({ err: "Internal Server Error", error: error.message });
  }
};

const markAbsencesForMonth = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id, month } = req.params;

    // Validate inputs
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: "Valid Employee ID is required" });
    }
    if (!month) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: "Month is required" });
    }

    const targetMonth = moment(month, "YYYY-MM", true).startOf("month");
    if (!targetMonth.isValid()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: "Invalid month format. Use YYYY-MM" });
    }

    const currentMonth = moment().startOf("month");
    if (targetMonth.isAfter(currentMonth)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: "Cannot mark absences for future months" });
    }

    const employee = await EmployeeModel.findById(id).session(session);
    if (!employee) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, error: "Employee not found" });
    }

    const daysInMonth = targetMonth.daysInMonth();
    const startOfMonth = targetMonth.clone().startOf("month").toDate();
    const endOfMonth = targetMonth.clone().endOf("month").startOf("day").toDate();

    // Fetch existing data with midnight-normalized dates
    const [existingAttendance, holidays, approvedLeaves] = await Promise.all([
      AttendanceModel.find({
        employee: id,
        attendanceDate: {
          $gte: startOfMonth,
          $lte: endOfMonth,
        },
      }).session(session),
      HolidayModel.find({
        date: {
          $gte: startOfMonth,
          $lte: endOfMonth,
        },
      }).session(session),
      LeaveModel.find({
        employee: id,
        status: "Approved",
        $or: [
          { startDate: { $lte: endOfMonth } },
          { endDate: { $gte: startOfMonth } },
        ],
      }).session(session),
    ]);

    // Create Sets for efficient lookup with midnight-normalized dates
    const attendanceDates = new Set(
      existingAttendance.map((record) =>
        moment(record.attendanceDate).startOf("day").format("YYYY-MM-DD")
      )
    );
    const holidayDates = new Set(
      holidays.map((holiday) =>
        moment(holiday.date).startOf("day").format("YYYY-MM-DD")
      )
    );
    const leaveDates = new Set();
    approvedLeaves.forEach((leave) => {
      const start = moment(leave.startDate).startOf("day");
      const end = moment(leave.endDate).startOf("day");
      for (
        let date = start.clone();
        date.isSameOrBefore(end, "day");
        date.add(1, "day")
      ) {
        leaveDates.add(date.format("YYYY-MM-DD"));
      }
    });

    // Process each day in the month with midnight-normalized dates
    const attendanceRecords = [];
    let absenceCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = moment(targetMonth).date(day).startOf("day");
      const dateString = currentDate.format("YYYY-MM-DD");

      // Skip if any attendance record exists (regardless of status)
      if (attendanceDates.has(dateString)) {
        continue;
      }

      // Skip approved leave dates
      if (leaveDates.has(dateString)) {
        continue;
      }

      // Skip Sundays
      if (currentDate.day() === 0) {
        continue;
      }

      // Skip holidays
      if (holidayDates.has(dateString)) {
        continue;
      }

      // Skip even-numbered Saturdays
      const isSaturday = currentDate.day() === 6;
      if (isSaturday) {
        const saturdayNumber = Math.ceil(currentDate.date() / 7);
        if (saturdayNumber % 2 === 0) {
          continue;
        }
      }

      // Mark as absent only if no prior record exists, store date at midnight
      attendanceRecords.push({
        employee: id,
        employeeModell: "employeeModel",
        attendanceDate: currentDate.startOf("day").toDate(), // Ensure midnight
        status: "Absence",
        timeIn: null,
        timeOut: null,
        lateBy: 0,
        totalHours: 0,
        previousAttendance: [],
      });
      absenceCount++;
    }

    // Bulk insert absence records
    if (attendanceRecords.length > 0) {
      await AttendanceModel.insertMany(attendanceRecords, { session });
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      msg: `Absences marked successfully for ${
        employee.employeeName || "Unknown Employee"
      } in ${month}. ${absenceCount} absence records created.`,
      data: { absenceCount },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error marking absences:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
};

// Export the controller
module.exports = { markAbsencesForDate, markAbsencesForMonth };
