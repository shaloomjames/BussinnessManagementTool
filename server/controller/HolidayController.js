const HolidayModel = require("../models/HolidayModel");
const LeaveModel = require("../models/LeaveModel");
const AttendanceModel = require("../models/AttendanceModel");
const { default: mongoose } = require("mongoose");
const EmployeeModel = require("../models/EmployeeModel");


// Get Holidays
const getHolidays = async (req, res) => {
  try {
    const holidays = await HolidayModel.find()
      .populate("createdBy")
      .populate("affectedAttendance");
      
    if (!holidays.length) return res.status(404).json({ err: "No Holidays Found" });

    res.status(200).json(holidays);
  } catch (error) {
    console.error("Holiday fetch error:", error);
    return res
      .status(500)
      .json({ err: "Internal Server Error", error: error.message });
    }
};

const getSingleHoliday = async (req, res) => {
  try {
    const _id = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(_id))
      return res.status(400).json({ err: "Invalid Id Format" });
    
    const holiday = await HolidayModel.findById(_id)
    .populate("createdBy")
    .populate("affectedAttendance");
    
    if (!holiday.length) return res.status(404).json({ err: "Holiday Not Found" });
    
    return res.status(200).json(holiday);
  } catch (error) {
    console.log("Error Fetching Single Holiday", error);
    return res
    .status(500)
    .json({ err: "Internal Server Error", error: error.message });
  }
};


const createHoliday = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Extract holiday details from request body
    const { name, date, description, createdBy } = req.body;

    // Regular expression to validate name and description
    const nameRegex = /^[A-Za-z0-9\s.,!?'"()-]+$/;

    // Validate name
    if (!name || !nameRegex.test(name)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        err: "Invalid name. Only letters, numbers, spaces, and some punctuation are allowed.",
      });
    }

    // Validate description (optional)
    if (description && !nameRegex.test(description)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        err: "Invalid description. Only letters, numbers, spaces, and some punctuation are allowed.",
      });
    }

    // Validate date
    if (!date) {
      await session.abortTransaction(); 
      session.endSession();
      return res.status(400).json({ err: "Date is required" });
    }

    // Normalize dates to midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const holidayDate = new Date(date);
    holidayDate.setHours(0, 0, 0, 0);

    // Ensure holiday is for today or a future date
    if (holidayDate.getTime() < today.getTime()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ err: "Holiday date must be today or a future date" });
    }

    // Check if holiday falls on a weekend
    const dayOfWeek = holidayDate.getDay();
    if (dayOfWeek === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ err: "Holiday cannot be created on Sunday (weekend)" });
    }
    if (dayOfWeek === 6) {
      const weekNumber = Math.ceil(holidayDate.getDate() / 7);
      if (weekNumber % 2 === 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ err: "Holiday cannot be created on even-numbered Saturdays (weekend)" });
      }
    }

    // Check for duplicate holiday
    const existingHoliday = await HolidayModel.findOne({ date: holidayDate });
    if (existingHoliday) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ err: "A holiday already exists on this date" });
    }

    // Create the holiday record
    const holiday = await HolidayModel.create(
      [{
        name,
        date: holidayDate,
        description: description || "",
        createdBy,
        affectedAttendance: [],
      }],
      { session }
    ).then((result) => result[0]);

    // Fetch all employees
    const employees = await EmployeeModel.find().session(session);

    // Process each employee's attendance for the holiday date
    await Promise.all(
      employees.map(async (employee) => {
        // Check if attendance exists for this employee on the holiday date
        let attendance = await AttendanceModel.findOne({
          employee: employee._id,
          attendanceDate: holidayDate,
        }).session(session);

        if (attendance) {
          // If attendance exists and is "On Leave", reduce leave balance
          if (attendance.status === "On Leave") {
            // Find the leave request associated with this attendance
            const leave = await LeaveModel.findOne({
              employee: employee._id,
              startDate: { $lte: holidayDate },
              endDate: { $gte: holidayDate },
              status: "Approved",
              affectedAttendance: attendance._id,
            }).session(session);

            if (leave) {
              // Update employee's leave balance for this leave type
              const leaveBalance = employee.leaveBalances.find((balance) =>
                balance.leaveTypeId.equals(leave.leaveType)
              );

              if (leaveBalance && leaveBalance.currentBalance > 0) {
                leaveBalance.currentBalance -= 1; // Reduce one leave day
                await employee.save({ session }); // Save updated employee

                // Update leave record's calculatedDays
                if (leave.calculatedDays > 0) {
                  leave.calculatedDays -= 1;
                  // Add holiday to leave's holidays array if not already present
                  if (!leave.holidays.some(h => h.equals(holiday._id))) {
                    leave.holidays.push(holiday._id);
                  }
                  await leave.save({ session });
                }
              }
            }

            // Convert "On Leave" to "Holiday" and store previous data
            if (!attendance.previousAttendance) {
              attendance.previousAttendance = [];
            }
            attendance.previousAttendance.push({
              timeIn: attendance.timeIn,
              timeOut: attendance.timeOut,
              status: attendance.status,
              lateBy: attendance.lateBy,
              totalHours: attendance.totalHours,
              leaveConvertedToHolidayCount: 1, // Mark that it was converted from "On Leave"
              updatedAt: Date.now(),
            });
            attendance.status = "Holiday";
            attendance.timeIn = null;
            attendance.timeOut = null;
            attendance.lateBy = 0;
            attendance.totalHours = 0;
            holiday.affectedAttendance.push(attendance._id);
            await attendance.save({ session });
          }
          // Handle other statuses ("On Time", "Late", "Absence")
          else if (["On Time", "Late", "Absence"].includes(attendance.status)) {
            if (!attendance.previousAttendance) {
              attendance.previousAttendance = [];
            }
            attendance.previousAttendance.push({
              timeIn: attendance.timeIn,
              timeOut: attendance.timeOut,
              status: attendance.status,
              lateBy: attendance.lateBy,
              totalHours: attendance.totalHours,
              leaveConvertedToHolidayCount: 0,
              updatedAt: Date.now(),
            });
            attendance.status = "Holiday";
            attendance.timeIn = null;
            attendance.timeOut = null;
            attendance.lateBy = 0;
            attendance.totalHours = 0;
            holiday.affectedAttendance.push(attendance._id);
            await attendance.save({ session });
          }
        } else {
          // If no attendance exists, create a new "Holiday" record
          const newAttendance = await AttendanceModel.create(
            [{
              employee: employee._id,
              employeeModell: "employeeModel",
              attendanceDate: holidayDate,
              status: "Holiday",
              timeIn: null,
              timeOut: null,
              lateBy: 0,
              totalHours: 0,
              previousAttendance: [],
            }],
            { session }
          ).then((result) => result[0]);
          holiday.affectedAttendance.push(newAttendance._id);
        }
      })
    );

    // Save the holiday with updated affectedAttendance
    await holiday.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      msg: "Holiday created, attendance updated, and leave balances adjusted successfully",
      data: holiday,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Holiday creation error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ err: "Holiday or attendance already exists for this date" });
    }
    return res.status(500).json({ err: "Internal Server Error", details: error.message });
  }
};

const deleteHoliday = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const _id = req.params.id;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ err: "Invalid Id Format" });
    }

    // Find the holiday
    const holiday = await HolidayModel.findById(_id).session(session);
    if (!holiday) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ err: "Holiday Not Found" });
    }

    const holidayDate = new Date(holiday.date);
    holidayDate.setHours(0, 0, 0, 0);

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Optional: Prevent deletion of past holidays
    if (holidayDate < currentDate) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        err: "Holiday date is in the past. Deletion is not allowed.",
      });
    }

    // Find attendance records affected by this holiday (using affectedAttendance)
    const attendanceRecords = await AttendanceModel.find({
      _id: { $in: holiday.affectedAttendance },
      attendanceDate: holidayDate,
      status: "Holiday",
    }).session(session);

    const bulkOps = [];
    const employeesToUpdate = new Map(); // Track employees for leave balance updates

    // Process each attendance record
    await Promise.all(
      attendanceRecords.map(async (attendance) => {
        if (attendance.previousAttendance && attendance.previousAttendance.length > 0) {
          const previousAttendance = attendance.previousAttendance[attendance.previousAttendance.length - 1];

          // If reverting to "On Leave", adjust leave balance and leave record
          if (previousAttendance.status === "On Leave") {
            const employee = await EmployeeModel.findById(attendance.employee).session(session);
            const leave = await LeaveModel.findOne({
              employee: attendance.employee,
              startDate: { $lte: holidayDate },
              endDate: { $gte: holidayDate },
              status: "Approved",
              affectedAttendance: attendance._id,
            }).session(session);

            if (leave && employee) {
              const leaveBalance = employee.leaveBalances.find((balance) =>
                balance.leaveTypeId.equals(leave.leaveType)
              );
              if (leaveBalance) {
                leaveBalance.currentBalance -= 1; // Decrease leave balance (undo the increase)
                leave.calculatedDays += 1; // Restore the original calculated days
                leave.holidays = leave.holidays.filter(h => !h.equals(holiday._id)); // Remove holiday ID
                employeesToUpdate.set(employee._id.toString(), employee);
                await leave.save({ session });
              }
            }
          }

          // Revert attendance to previous state
          bulkOps.push({
            updateOne: {
              filter: { _id: attendance._id },
              update: {
                $set: {
                  timeIn: previousAttendance.timeIn,
                  timeOut: previousAttendance.timeOut,
                  status: previousAttendance.status,
                  lateBy: previousAttendance.lateBy,
                  totalHours: previousAttendance.totalHours,
                  leaveConvertedToHolidayCount: previousAttendance.leaveConvertedToHolidayCount,
                  updatedAt: previousAttendance.updatedAt,
                  previousAttendance: attendance.previousAttendance.slice(0, -1), // Remove the popped entry
                },
              },
            },
          });
        } else {
          // Delete attendance if it was created by createHoliday (no previous state)
          bulkOps.push({
            deleteOne: {
              filter: { _id: attendance._id },
            },
          });
        }
      })
    );

    // Apply bulk attendance updates
    if (bulkOps.length > 0) {
      await AttendanceModel.bulkWrite(bulkOps, { session });
    }

    // Save updated employees with reverted leave balances
    for (const employee of employeesToUpdate.values()) {
      await employee.save({ session });
    }

    // Delete the holiday
    const deletedHoliday = await HolidayModel.findByIdAndDelete(_id, { session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      msg: "Holiday deleted successfully, attendance and leave balances reverted",
      data: deletedHoliday,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error deleting Holiday:", error.message);
    if (error.code === 11000) {
      return res.status(409).json({ err: "Conflict in attendance or holiday data" });
    }
    return res.status(500).json({ err: "Internal Server Error", details: error.message });
  }
};

const updateHoliday = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const _id = req.params.id;
    const { name, date, description } = req.body;
    const nameRegex = /^[A-Za-z0-9\s.,!?'"()-]+$/;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ err: "Invalid Id Format" });
    }

    // Validate name and description
    if (name && !nameRegex.test(name)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ err: "Invalid name..." });
    }
    if (description && !nameRegex.test(description)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ err: "Invalid description..." });
    }

    // Find holiday
    const holiday = await HolidayModel.findById(_id).session(session);
    if (!holiday) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ err: "Holiday Not Found" });
    }

    // Normalize dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    const oldDate = new Date(holiday.date);
    oldDate.setHours(0, 0, 0, 0);

    // Validate dates
    if (newDate < today) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ err: "Holiday date must be today or a future date" });
    }
    if (oldDate < today) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ err: "Cannot update past holidays" });
    }

    // Handle date change
    const employeesToUpdate = new Map();
    if (newDate.getTime() !== oldDate.getTime()) {
      // Check for duplicate holiday
      const existingHoliday = await HolidayModel.findOne({
        date: newDate,
        _id: { $ne: _id },
      }).session(session);
      if (existingHoliday) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({ err: "A holiday already exists on this date" });
      }

      // Revert old date (like deleteHoliday)
      const oldAttendanceRecords = await AttendanceModel.find({
        _id: { $in: holiday.affectedAttendance },
        attendanceDate: oldDate,
        status: "Holiday",
      }).session(session);

      const bulkRevertOps = [];
      await Promise.all(
        oldAttendanceRecords.map(async (attendance) => {
          if (attendance.previousAttendance && attendance.previousAttendance.length > 0) {
            const previousAttendance = attendance.previousAttendance[attendance.previousAttendance.length - 1];
            if (previousAttendance.status === "On Leave") {
              const employee = await EmployeeModel.findById(attendance.employee).session(session);
              const leave = await LeaveModel.findOne({
                employee: attendance.employee,
                startDate: { $lte: oldDate },
                endDate: { $gte: oldDate },
                status: "Approved",
                affectedAttendance: attendance._id,
              }).session(session);
              if (leave && employee) {
                const leaveBalance = employee.leaveBalances.find((balance) =>
                  balance.leaveTypeId.equals(leave.leaveType)
                );
                if (leaveBalance) {
                  leaveBalance.currentBalance -= 1;
                  leave.calculatedDays += 1;
                  leave.holidays = leave.holidays.filter(h => !h.equals(holiday._id));
                  employeesToUpdate.set(employee._id.toString(), employee);
                  await leave.save({ session });
                }
              }
            }
            bulkRevertOps.push({
              updateOne: {
                filter: { _id: attendance._id },
                update: {
                  $set: {
                    timeIn: previousAttendance.timeIn,
                    timeOut: previousAttendance.timeOut,
                    status: previousAttendance.status,
                    lateBy: previousAttendance.lateBy,
                    totalHours: previousAttendance.totalHours,
                    leaveConvertedToHolidayCount: previousAttendance.leaveConvertedToHolidayCount,
                    updatedAt: previousAttendance.updatedAt,
                    previousAttendance: attendance.previousAttendance.slice(0, -1),
                  },
                },
              },
            });
          } else {
            bulkRevertOps.push({
              deleteOne: { filter: { _id: attendance._id } },
            });
          }
        })
      );
      if (bulkRevertOps.length > 0) {
        await AttendanceModel.bulkWrite(bulkRevertOps, { session });
      }

      // Clear affectedAttendance for new date
      holiday.affectedAttendance = [];

      // Apply new date (like createHoliday)
      const employees = await EmployeeModel.find().session(session);
      await Promise.all(
        employees.map(async (employee) => {
          let attendance = await AttendanceModel.findOne({
            employee: employee._id,
            attendanceDate: newDate,
          }).session(session);

          if (attendance) {
            if (attendance.status === "On Leave") {
              const leave = await LeaveModel.findOne({
                employee: employee._id,
                startDate: { $lte: newDate },
                endDate: { $gte: newDate },
                status: "Approved",
                affectedAttendance: attendance._id,
              }).session(session);
              if (leave) {
                const leaveBalance = employee.leaveBalances.find((balance) =>
                  balance.leaveTypeId.equals(leave.leaveType)
                );
                if (leaveBalance) {
                  leaveBalance.currentBalance += 1;
                  await employee.save({ session });
                  if (leave.calculatedDays > 0) {
                    leave.calculatedDays -= 1;
                    if (!leave.holidays.some(h => h.equals(holiday._id))) {
                      leave.holidays.push(holiday._id);
                    }
                    await leave.save({ session });
                  }
                }
              }
            }
            if (!attendance.previousAttendance) attendance.previousAttendance = [];
            attendance.previousAttendance.push({
              timeIn: attendance.timeIn,
              timeOut: attendance.timeOut,
              status: attendance.status,
              lateBy: attendance.lateBy,
              totalHours: attendance.totalHours,
              leaveConvertedToHolidayCount: attendance.status === "On Leave" ? 1 : 0,
              updatedAt: Date.now(),
            });
            attendance.status = "Holiday";
            attendance.timeIn = null;
            attendance.timeOut = null;
            attendance.lateBy = 0;
            attendance.totalHours = 0;
            holiday.affectedAttendance.push(attendance._id);
            await attendance.save({ session });
          } else {
            const newAttendance = await AttendanceModel.create(
              [{
                employee: employee._id,
                employeeModell: "employeeModel",
                attendanceDate: newDate,
                status: "Holiday",
                timeIn: null,
                timeOut: null,
                lateBy: 0,
                totalHours: 0,
                previousAttendance: [],
              }],
              { session }
            ).then((result) => result[0]);
            holiday.affectedAttendance.push(newAttendance._id);
          }
        })
      );
    }

    // Update holiday fields
    if (name) holiday.name = name;
    if (date) holiday.date = newDate;
    if (description) holiday.description = description;
    await holiday.save({ session });

    // Save updated employees
    for (const employee of employeesToUpdate.values()) {
      await employee.save({ session });
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      msg: "Holiday updated successfully",
      data: holiday,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating Holiday:", error);
    return res.status(500).json({ err: "Internal Server Error", details: error.message });
  }
};


module.exports = {
  createHoliday,
  getHolidays,
  deleteHoliday,
  updateHoliday,
  getSingleHoliday,
};
