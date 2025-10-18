import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';

const AddSalary = () => {
  const [attendanceReport, setAttendanceReport] = useState(null);
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeeAllowances, setEmployeeAllowances] = useState([{ name: '', amount: 0 }]);
  const [totalAllowanceAmount, setTotalAllowanceAmount] = useState(0);
  const [monthTotalDays, setMonthTotalDays] = useState(0); // Renamed for clarity
  const [totalWorkingDays, setTotalWorkingDays] = useState(0);
  const [daysOnTime, setDaysOnTime] = useState(0);
  const [daysLate, setDaysLate] = useState(0);
  const [absentDays, setAbsentDays] = useState(0);
  const [totalAbsentDays, setTotalAbsentDays] = useState(0);
  const [daysLateLeft, setDaysLateLeft] = useState(0);
  const [effectiveAbsentDays, setEffectiveAbsentDays] = useState(0);
  const [basicSalary, setBasicSalary] = useState(0);
  const [salaryPerDay, setSalaryPerDay] = useState(0);
  const [salarySubtotal, setSalarySubtotal] = useState(0);
  const [employeeDeductions, setEmployeeDeductions] = useState([{ name: 'Absents', amount: 0 }]);
  const [totalDeduction, setTotalDeduction] = useState(0);
  const [netSalary, setNetSalary] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [totalAttendanceRecordDays, setTotalAttendanceRecordDays] = useState(0);

  const navigate = useNavigate();
  const { month, id } = useParams();

  const showErrorAlert = (message) => {
    Swal.fire({
      icon: 'error',
      title: 'Oops...',
      text: message,
      timer: 9000,
      timerProgressBar: true,
      showConfirmButton: false,
      willClose: () => navigate('/SelectSalaryusers'),
    });
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

  // Secure page with role-based access
  useEffect(() => {
    const userToken = Cookies.get("UserAuthToken");
    if (!userToken) {
      navigate("/login");
      return;
    }
    try {
      const decodedToken = jwtDecode(userToken);
      const userRole = decodedToken.userrole;
      if (!(Array.isArray(userRole) && userRole.includes("Admin")) && userRole !== "Admin") {
        navigate("/login"); // Fixed typo "和中国" to "&&"
      }
    } catch (error) {
      console.error("Token decoding failed:", error);
      navigate("/login");
    }
  }, [navigate]);

  // Fetch attendance report
  useEffect(() => {
    const fetchAttendanceReport = async () => {
      try {
        if (!id) {
          showErrorAlert("Employee ID is required.");
          return;
        }
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/attendance/report/${id}/${month}`);
        console.log(response.data);
        setAttendanceReport(response.data);
        setEmployeeName(response.data?.employee?.employeeName || '');
        setEmployeeEmail(response.data?.employee?.employeeEmail || '');
        setMonthTotalDays(response.data?.totalDays || 0);
        setBasicSalary(response.data?.employee?.employeeSalary || 0);
        setEmployeeId(response.data?.employee?._id || '');
        const allowancesFromBackend = response.data?.employee?.employeeallowances || [];
        const formattedAllowances = allowancesFromBackend.map(allowance => ({
          name: allowance.name || '', 
          amount: Number(allowance.amount) || 0 // Ensure number type
        }));
        setEmployeeAllowances(formattedAllowances);
        setAbsentDays(response.data?.absentDays || 0);
        setDaysOnTime(response.data?.daysOnTime || 0);
        setDaysLate(response.data?.daysLate || 0);
        setTotalWorkingDays(response.data?.workingDays || 0);
        setEffectiveAbsentDays(response.data?.effectiveAbsentDays || 0);
        setDaysLateLeft(response.data?.remainingLates || 0);
        setTotalAbsentDays(response.data?.totalAbsentDays || 0);
        setTotalAttendanceRecordDays(response.data?.totalAttendanceRecordDays || 0);
        setIsLoaded(true);
      } catch (error) {
        showErrorAlert(error.response?.data?.err || 'Error fetching attendance report');
        setTimeout(() => navigate("/SelectSalaryusers"), 3000);
      }
    };
    fetchAttendanceReport();
  }, [month, id]);

  // Calculate salary per day
  useEffect(() => {
    if (totalWorkingDays > 0) {
      setSalaryPerDay(basicSalary / totalWorkingDays);
    } else {
      setSalaryPerDay(0);
    }
  }, [basicSalary, totalWorkingDays]);

  // Calculate subtotal
  useEffect(() => {
    const subtotal = Number(basicSalary) + Number(totalAllowanceAmount);
    setSalarySubtotal(subtotal);
  }, [basicSalary, totalAllowanceAmount]);

  // Calculate deductions and net salary
  useEffect(() => {
    const absentsDeduction = totalAbsentDays * salaryPerDay;
    const deductionsWithAbsents = [
      { name: "Absents", amount: absentsDeduction || 0 },
      ...employeeDeductions.filter((deduction) => deduction.name !== "Absents"),
    ];
    const totalDeductions = deductionsWithAbsents.reduce(
      (acc, deduction) => acc + (Number(deduction.amount) || 0),
      0
    );
    const netSalaryCalculation = salarySubtotal - totalDeductions;
    setEmployeeDeductions(deductionsWithAbsents);
    setTotalDeduction(totalDeductions);
    setNetSalary(netSalaryCalculation < 0 ? 0 : netSalaryCalculation);
  }, [totalAbsentDays, salaryPerDay, salarySubtotal, employeeDeductions]);

  // Calculate total allowance
  useEffect(() => {
    const total = employeeAllowances.reduce(
      (acc, allowance) => acc + (Number(allowance.amount) || 0),
      0
    );
    setTotalAllowanceAmount(total);
  }, [employeeAllowances]);

  // Calculate total deduction
  useEffect(() => {
    const total = employeeDeductions.reduce(
      (acc, deduction) => acc + (Number(deduction.amount) || 0),
      0
    );
    setTotalDeduction(total);
  }, [employeeDeductions]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) {
      Swal.fire({
        icon: "warning",
        title: "Request Already Sent",
        text: "Please wait while we process your previous request",
        timer: 2000,
        showConfirmButton: false,
      });
      return;
    }
    setIsSubmitting(true);

    const formData = {
      selectedMonth: month,
      employeeId,
      employeeName,
      employeeEmail,
      monthtotalDays: monthTotalDays, // Fixed naming consistency
      totalWorkingDays,
      daysOnTime,
      daysLate,
      daysLateLeft,
      absentDays,
      effectiveAbsentDays,
      totalAbsentDays,
      basicSalary,
      salaryPerDay,
      salarySubtotal,
      netSalary,
      allowances: employeeAllowances,
      totalAllowanceAmount,
      deductions: employeeDeductions,
      totalDeduction,
      remarks,
      totalAttendanceRecordDays,
    };

    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/salary`, formData);
      showSuccessAlert(res.data.msg);
      setTimeout(() => navigate("/showSalaries"), 4000);
    } catch (error) {
      showErrorAlert(error.response?.data?.err || "Failed to add salary");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAllowanceChange = (index, key, value) => {
    const updatedAllowances = [...employeeAllowances];
    updatedAllowances[index][key] = key === 'amount' ? Number(value) || 0 : value; // Convert amount to number
    setEmployeeAllowances(updatedAllowances);
  };

  const addAllowanceField = () => {
    setEmployeeAllowances([...employeeAllowances, { name: '', amount: 0 }]);
  };

  const removeAllowanceField = (index) => {
    const updatedAllowances = employeeAllowances.filter((_, i) => i !== index);
    setEmployeeAllowances(updatedAllowances);
  };

  const handleDeductionChange = (index, key, value) => {
    const updatedDeductions = [...employeeDeductions];
    updatedDeductions[index][key] = key === 'amount' ? Number(value) || 0 : value; // Convert amount to number
    setEmployeeDeductions(updatedDeductions);
  };

  const addDeductionField = () => {
    setEmployeeDeductions([...employeeDeductions, { name: '', amount: 0 }]);
  };

  const removeDeductionField = (index) => {
    const updatedDeductions = employeeDeductions.filter((_, i) => i !== index);
    setEmployeeDeductions(updatedDeductions);
  };

  return (
    <div className="container-fluid">
      <Link className="btn mb-3 btn-primary" onClick={() => navigate(-1)}>
        <i className="fa-solid fa-arrow-left-long" style={{ fontSize: '20px', fontWeight: '900' }}></i>
      </Link>
      <form onSubmit={handleSubmit}>
        <div className="row mb-2">
          <div className="col-lg-12">
            <div className="card">
              <div className="card-body">
                <h4 className="card-title mb-5">Add Salary</h4>
                {isLoaded ? (
                  <>
                    <p><strong>Employee ID:</strong> {attendanceReport?.employee?.employeeId || 'N/A'}</p>
                    <p><strong>Employee Email:</strong> {attendanceReport?.employee?.employeeEmail || 'N/A'}</p>
                  </>
                ) : (
                  <p>Loading attendance report...</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="row mb-3">
          <div className="col-lg-12">
            <div className="card">
              <div className="card-body">
                <div className="table-responsive">
                  {isLoaded ? (
                    <>
                      <h4>Attendance Summary for {attendanceReport?.reportMonth || 'N/A'}</h4>
                      <table className="table header-border">
                        <thead>
                          <tr>
                            <th>Total Days In Month</th>
                            <th>Total Weekends (Sundays + Even Saturdays)</th>
                            <th>Working Days (Excluding Weekends)</th>
                            <th>Days On Time</th>
                            <th>Days Late</th>
                            <th>On Holiday</th>
                            <th>On Leave</th>
                            <th>Absent Days (Excluding Weekends)</th>
                            <th>Effective Absents (Conversion from lates)</th>
                            <th>Effective Lates Left (after conversion to absent)</th>
                            <th>Total Logged Days</th>
                            <th>Total Absents</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>{monthTotalDays || 0}</td>
                            <td>{attendanceReport?.totalWeekends || 0}</td>
                            <td>{totalWorkingDays || 0}</td>
                            <td>{daysOnTime || 0}</td>
                            <td>{daysLate || 0}</td>
                            <td>{attendanceReport?.Holiday || 0}</td>
                            <td>{attendanceReport?.OnLeave || 0}</td>
                            <td>{absentDays || 0}</td>
                            <td>{effectiveAbsentDays || 0}</td>
                            <td>{daysLateLeft || 0}</td>
                            <td>{totalAttendanceRecordDays || 0}</td>
                            <td>{totalAbsentDays || 0}</td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p>Loading attendance report...</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row mb-2">
          <div className="col-lg-6 mb-1">
            <div className="card" style={{ minHeight: "40vh" }}>
              <div className="card-body">
                <div className="form-group">
                  <label>Employee Allowances:</label>
                  {employeeAllowances.length > 0 ? (
                    employeeAllowances.map((allowance, index) => (
                      <div key={index} className="d-flex align-items-center mb-2">
                        <input
                          type="text"
                          placeholder="Allowance Name"
                          className="form-control me-2"
                          value={allowance.name}
                          onChange={(e) => handleAllowanceChange(index, 'name', e.target.value)}
                        />
                        <input
                          type="number"
                          placeholder="Allowance Amount"
                          className="form-control me-2"
                          min={0}
                          value={allowance.amount}
                          onChange={(e) => handleAllowanceChange(index, 'amount', e.target.value)}
                        />
                        {employeeAllowances.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-danger ms-2"
                            onClick={() => removeAllowanceField(index)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <h4>No Allowances</h4>
                  )}
                  <button type="button" className="btn btn-primary" onClick={addAllowanceField}>
                    Add Another Allowance
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-6 mb-1">
            <div className="card" style={{ minHeight: "40vh" }}>
              <div className="card-body">
                <div className="form-group">
                  <label>Employee Deduction:</label>
                  {employeeDeductions.length > 0 ? (
                    employeeDeductions.map((deduction, index) => (
                      <div key={index} className="d-flex align-items-center mb-2">
                        <input
                          type="text"
                          placeholder="Deduction Name"
                          className="form-control me-2"
                          value={deduction.name}
                          onChange={(e) => handleDeductionChange(index, 'name', e.target.value)}
                        />
                        <input
                          type="number"
                          placeholder="Deduction Amount"
                          className="form-control me-2"
                          min={0}
                          value={deduction.amount}
                          onChange={(e) => handleDeductionChange(index, 'amount', e.target.value)}
                          step="any"
                          required
                        />
                        {employeeDeductions.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-danger ms-2"
                            onClick={() => removeDeductionField(index)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <h4>No Deductions</h4>
                  )}
                  <button type="button" className="btn btn-primary" onClick={addDeductionField}>
                    Add Another Deduction
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row mb-5">
          <div className="col-lg-12 mb-5">
            <div className="card">
              <div className="card-body">
                <center><h4 className="card-title">Summary</h4></center>
                <hr />
                <div className="basic-form">
                  <div className="form-group row">
                    <div className="col-sm-1"></div>
                    <label className="col-sm-3 col-form-label">Basic Salary</label>
                    <div className="col-sm-6">
                      <input
                        type="number"
                        className="form-control"
                        placeholder="Basic Salary"
                        value={basicSalary.toFixed(2)}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="form-group row">
                    <div className="col-sm-1"></div>
                    <label className="col-sm-3 col-form-label">Salary Per Day</label>
                    <div className="col-sm-6">
                      <input
                        type="number"
                        className="form-control"
                        placeholder="Salary per day"
                        value={salaryPerDay.toFixed(2)}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="form-group row">
                    <div className="col-sm-1"></div>
                    <label className="col-sm-3 col-form-label">Total Allowance Amount</label>
                    <div className="col-sm-6">
                      <input
                        type="number"
                        className="form-control"
                        value={totalAllowanceAmount.toFixed(2)}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="form-group row">
                    <div className="col-sm-1"></div>
                    <label className="col-sm-3 col-form-label">Sub Total Salary</label>
                    <div className="col-sm-6">
                      <input
                        type="number"
                        className="form-control"
                        value={salarySubtotal.toFixed(2)}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="form-group row">
                    <div className="col-sm-1"></div>
                    <label className="col-sm-3 col-form-label">Total Deduction</label>
                    <div className="col-sm-6">
                      <input
                        type="number"
                        className="form-control"
                        value={totalDeduction.toFixed(2)}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="form-group row">
                    <div className="col-sm-1"></div>
                    <label className="col-sm-3 col-form-label">Net Salary</label>
                    <div className="col-sm-6">
                      <input
                        type="number"
                        className="form-control"
                        value={netSalary.toFixed(2)}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="form-group row">
                    <div className="col-sm-1"></div>
                    <label className="col-sm-3 col-form-label">Remarks</label>
                    <div className="col-sm-6">
                      <textarea
                        className="form-control"
                        placeholder="Leave Remarks About this Salary"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-group row">
                    <div className="col-sm-12">
                      <center>
                        <button
                          type="submit"
                          className="btn btn-primary px-5"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? "Confirming Pay Salary..." : "Confirm Pay Salary"}
                        </button>
                      </center>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
      <center className="card py-5" style={{ visibility: "hidden" }}>
        <div className="row" />
      </center>
    </div>
  );
};

export default AddSalary;