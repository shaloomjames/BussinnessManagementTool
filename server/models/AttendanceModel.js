const mongoose = require("mongoose");

const AttendanceSchema = mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "employeeModell",
      required: true,
    },
    employeeModell: {
      type: String,
      required: true,
      enum: ["employeeModel", "deletedEmployeeModel"],
      default: "employeeModel",
    },
    attendanceDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    timeIn: {
      type: Date,
      default: null,
      required: function () {
        return this.status !== "Holiday" && this.status !== "On Leave" && this.status !== "Absence";
      },
    },
    timeOut: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["On Time", "Late", "Absence", "Holiday", "On Leave"],
      default: "On Time",
      required: true,
    },
    lateBy: {
      type: Number,
      default: 0,
    },
    totalHours: {
      type: Number,
      required: [true, "Total hours worked is required"],
      min: 0,
      default: 0,
    },
    previousAttendance: [
      {
        timeIn: { type: Date },
        timeOut: { type: Date },
        status: { type: String },
        lateBy: { type: Number },
        totalHours: { type: Number },
        leaveConvertedToHolidayCount: { type: Number },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

AttendanceSchema.index({ employee: 1, attendanceDate: 1 }, { unique: true });

module.exports = mongoose.model("AttendanceModel", AttendanceSchema);