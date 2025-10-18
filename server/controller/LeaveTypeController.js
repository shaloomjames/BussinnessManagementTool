const mongoose = require("mongoose");
const LeaveTypeModel = require("../models/LeaveTypeModel");
const EmployeeModel = require("../models/EmployeeModel");
const LeaveModel = require("../models/LeaveModel");



const getLeaveType = async (req, res) => {
  try {
    // const { startingDate, endingDate } = req.query;

    // let filter = {};

    // if (startingDate && endingDate) {
    //   filter.expanceDate = {
    //     $gte: new Date(startingDate),
    //     $lte: new Date(endingDate),
    //   };
    // } else if (startingDate) {
    //   filter.expanceDate = { $gte: new Date(startingDate) };
    // } else if (endingDate) {
    //   filter.expanceDate = { $lte: new Date(endingDate) };
    // }

    // const expenses = await LeaveTypeModel.find(filter)
    const leaveType = await LeaveTypeModel.find();

    if (!leaveType.length)
      return res.status(404).json({ err: "No data found" });

    return res.status(200).json(leaveType);
  } catch (error) {
    console.log("Error Reading leave Types:", error);
    return res.status(500).json({ err: "Internal Server Error" });
  }
};

const getActiveLeaveType = async (req, res) => {
  try {
    // const expenses = await LeaveTypeModel.find(filter)
    const leaveType = await LeaveTypeModel.find({ leaveTypeStatus: "active" });

    if (!leaveType.length)
      return res.status(404).json({ err: "No active leave types found" });

    return res.status(200).json(leaveType);
  } catch (error) {
    console.log("Error Reading active leave Types:", error);
    return res.status(500).json({ err: "Internal Server Error" });
  }
};

const getSingleLeaveType = async (req, res) => {
  try {
    // const { startingDate, endingDate } = req.query;

    // let filter = {};

    // if (startingDate && endingDate) {
    //   filter.expanceDate = {
    //     $gte: new Date(startingDate),
    //     $lte: new Date(endingDate),
    //   };
    // } else if (startingDate) {
    //   filter.expanceDate = { $gte: new Date(startingDate) };
    // } else if (endingDate) {
    //   filter.expanceDate = { $lte: new Date(endingDate) };
    // }

    const _id = req.params.id;
    console.log("Requested ID:", req.params.id);

    if (!mongoose.Types.ObjectId.isValid(_id))
      return res.status(400).json({ err: "Invalid Id Format" });

    const leaveType = await LeaveTypeModel.findById({ _id });

    if (!leaveType) return res.status(404).json({ err: "No data found" });

    return res.status(200).json(leaveType);
  } catch (error) {
    console.log("Error Reading leave Types:", error);
    return res.status(500).json({ err: "Internal Server Error" });
  }
};

const createLeaveType = async (req, res) => {
  try {
    const { leaveTypeName, allowedLeaves, leaveTypeStatus } = req.body;

    // Adjusted regex for letters and spaces
    const nameRegex = /^[A-Za-z\s]+$/;
    // Regex to match positive integers (1 or greater)
    const allowedLeavesRegex = /^[1-9]\d*$/;
    // const statusTypeRegex = /^(active|inactive)$/;

    if (!nameRegex.test(leaveTypeName)) {
      return res.status(400).json({
        err: "Invalid Leave Type Name. Only letters and spaces are allowed.",
      });
    }

    // Convert allowedLeaves to string for regex testing
    if (!allowedLeavesRegex.test(String(allowedLeaves))) {
      return res.status(400).json({
        err: "Invalid Allowed Leaves. Only positive numbers are allowed.",
      });
    }

    // if (!statusTypeRegex.test(leaveTypeStatus)) {
    //   return res.status(400).json({
    //     err: "Invalid Leave Type Status. Allowed values: active, inactive.",
    //   });
    // }

    // Check if leave type already exists
    const leaveExistence = await LeaveTypeModel.findOne({ leaveTypeName });
    if (leaveExistence) {
      return res.status(400).json({ err: "Leave Type Already Exists" });
    }

    // Create the new leave type
    const leaveType = await LeaveTypeModel.create({
      leaveTypeName,
      allowedLeaves,
      leaveTypeStatus,
    });

    // Fetch all employees
    const employees = await EmployeeModel.find();

    // Use Promise.all() to update employee leaveBalances concurrently
    await Promise.all(
      employees.map(async (employee) => {
        // Check if the employee's leaveBalances already has an entry for this leave type
        const leaveBalanceExists = employee.leaveBalances.some(
          (lb) =>
            lb.leaveTypeId &&
            lb.leaveTypeId.toString() === leaveType._id.toString()
        );

        if (!leaveBalanceExists) {
          // Add the new leave type to the employee's leaveBalances array
          employee.leaveBalances.push({
            leaveTypeId: leaveType._id,
            allowedLeaves: allowedLeaves,
            currentBalance: allowedLeaves, // Initially set currentBalance equal to allowedLeaves
          });

          // Save the updated employee record
          await employee.save();
        }
      })
    );

    return res.status(201).json({
      leaveType,
      msg: "Leave type created and employees updated successfully",
    });
  } catch (error) {
    console.error("Error creating leave type:", error);
    return res
      .status(500)
      .json({ err: "Internal server error", error: error.message });
  }
};

const updateLeaveType = async (req, res) => {
  try {
    const _id = req.params.id;
    const { leaveTypeName, allowedLeaves, leaveTypeStatus } = req.body;

    // Adjusted regex for letters and spaces
    const nameRegex = /^[A-Za-z\s]+$/;
    // Regex to match positive integers (1 or greater)
    const allowedLeavesRegex = /^[1-9]\d*$/;
    const statusTypeRegex = /^(active|inactive)$/;

    if (!nameRegex.test(leaveTypeName)) {
      return res.status(400).json({
        err: "Invalid Leave Type Name. Only letters and spaces are allowed.",
      });
    }

    // Convert allowedLeaves to string for regex testing
    if (!allowedLeavesRegex.test(String(allowedLeaves))) {
      return res.status(400).json({
        err: "Invalid Allowed Leaves. Only positive numbers are allowed.",
      });
    }

    if (!statusTypeRegex.test(leaveTypeStatus)) {
      return res.status(400).json({
        err: "Invalid Leave Type Status. Allowed values: active, inactive.",
      });
    }

    // Verify that the leave type exists
    const leaveExistence = await LeaveTypeModel.findOne({ _id });
    if (!leaveExistence)
      return res.status(400).json({ err: "Leave Type Not Found" });

    // Check if there's any other leave type with the same name (to avoid duplicates)
    const leaveTypeWithSameName = await LeaveTypeModel.findOne({
      leaveTypeName,
    });
    if (leaveTypeWithSameName && leaveTypeWithSameName._id.toString() !== _id) {
      return res
        .status(400)
        .json({ err: "Leave Type with the same name already exists" });
    }

    // Update the leave type document and return the updated record
    const updatedLeaveType = await LeaveTypeModel.findByIdAndUpdate(
      { _id },
      { leaveTypeName, allowedLeaves, leaveTypeStatus },
      { new: true }
    );

    // Now update each employee's leaveBalances concurrently using Promise.all()
    const employees = await EmployeeModel.find();


const updatePromises = employees.map(async (employee) => {
  const leaveTypeId = updatedLeaveType._id.toString();
  const employeeLeaveBalance = employee.leaveBalances.find(
    (lb) => lb.leaveTypeId.toString() === leaveTypeId
  );
  if (employeeLeaveBalance) {
    const oldAllowedLeaves = employeeLeaveBalance.allowedLeaves;
    const difference = allowedLeaves - oldAllowedLeaves;

    employeeLeaveBalance.allowedLeaves = allowedLeaves;
    employeeLeaveBalance.currentBalance += difference;

    if (employeeLeaveBalance.currentBalance < 0) {
      employeeLeaveBalance.currentBalance = 0;
    }

    if (employeeLeaveBalance.currentBalance > employeeLeaveBalance.allowedLeaves) {
      employeeLeaveBalance.currentBalance = employeeLeaveBalance.allowedLeaves;
    }

    await employee.save();
  }
});

    await Promise.all(updatePromises);

    return res.status(200).json({ msg: "Leave Type Updated Successfully" });
  } catch (error) {
    console.log("Error Updating Leave Type:", error);
    return res.status(500).json({ err: "Internal Server Error" });
  }
};

const deleteLeaveType = async (req, res) => {
  try {
    const _id = req.params.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ err: "Invalid Object Id" });
    }

    // Step 1: Get the leave type to be deleted
    const leaveTypeToDelete = await LeaveTypeModel.findById(_id);
    if (!leaveTypeToDelete) {
      return res.status(404).json({ err: "Leave Type not found" });
    }
    const leaveTypeName = leaveTypeToDelete.leaveTypeName;

    // // Step 2: Update LeaveModel - replace leaveType ObjectId with leaveTypeName
    const leaveUpdateResult = await LeaveModel.updateMany(
      { leaveType: _id }, // Find all leaves with this leaveType ObjectId
      {
        $set: {
          leaveTypeName: leaveTypeName, // Replace ObjectId with the name
        },
      }
    );

    // Step 3: Remove the leave type from all employees' leaveBalances
    const employeeUpdateResult = await EmployeeModel.updateMany(
      { "leaveBalances.leaveTypeId": _id },
      {
        $pull: {
          leaveBalances: { leaveTypeId: _id },
        },
      }
    );

    // Step 4: Delete the leave type from LeaveTypeModel
    const deletedLeaveType = await LeaveTypeModel.findByIdAndDelete(_id);

    // Success response
    return res.status(200).json({
      msg: "Leave Type deleted successfully and references updated",
      data: {
        deletedLeaveType: deletedLeaveType,
        affectedRecords: {
          employeesUpdated: employeeUpdateResult.modifiedCount,
          leavesUpdated: leaveUpdateResult.modifiedCount,
        },
      },
    });
  } catch (error) {
    console.error("Error Deleting Leave Type:", error);
    return res.status(500).json({
      err: "Internal Server Error",
      details: error.message,
    });
  }
};

module.exports = {
  createLeaveType,
  getLeaveType,
  getSingleLeaveType,
  getActiveLeaveType,
  updateLeaveType,
  deleteLeaveType,
};
