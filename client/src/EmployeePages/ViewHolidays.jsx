import React, { useEffect, useState } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

const ViewHolidays = () => {
  const [holidayData, setHolidayData] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false); // Added for loading feedback

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);

  const navigate = useNavigate();

  // Handle showing errors
  const showErrorAlert = (message) => {
    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: message,
    });
  };

  // Protect page and ensure only employees can access
  useEffect(() => {
    const userToken = Cookies.get("UserAuthToken");
    if (!userToken) {
      navigate("/login");
      return;
    }

    try {
      const decodedToken = jwtDecode(userToken);
      const userRole = decodedToken.userrole;
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

  // Fetch holiday data
  useEffect(() => {
    const fetchHolidayData = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/holiday`);
        setHolidayData(response.data);
        setFilteredRecords(response.data);
      } catch (error) {
        console.error("Error fetching holiday data from API:", error);
        showErrorAlert(
          error.response?.data?.err || "Error Fetching Holidays"
        );
      } finally {
        setLoading(false);
      }
    };
    fetchHolidayData();
  }, []);

  // Update total pages
  useEffect(() => {
    const newTotal = Math.ceil(filteredRecords.length / pageSize) || 1; // Minimum 1 page
    setTotalPages(newTotal);
    if (page > newTotal) setPage(newTotal);
  }, [filteredRecords, pageSize, page]);

  // Filter records by month and search
  useEffect(() => {
    let filtered = holidayData;

    if (selectedMonth) {
      filtered = filtered.filter((record) =>
        new Date(record?.date).toISOString().slice(0, 7) === selectedMonth
      );
    }

    if (search) {
      const searchLower = search.toLowerCase().trim();
      filtered = filtered.filter(
        (record) =>
          (record.name && record.name.toLowerCase().includes(searchLower)) ||
          (record.description &&
            record.description.toLowerCase().includes(searchLower))
      );
    }

    setFilteredRecords(filtered);
    setPage(1); // Reset to first page
  }, [search, selectedMonth, holidayData]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  // Pagination slice
  const startIndex = (page - 1) * pageSize;
  const endIndex = page * pageSize;
  const currentData = filteredRecords.slice(startIndex, endIndex);

  return (
    <div className="container-fluid">
      {/* Filter Section */}
      <div className="row my-1">
        <div className="col-lg-12">
          <div className="card">
            <div className="card-body">
              <div className="row">
                <div className="col-lg-3 col-md-4">
                  <label>Select Month</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="form-control"
                  />
                </div>
                <div className="col-lg-4 col-md-6 col-sm-10"></div>
                <div className="col-lg-4 col-md-6 col-sm-10 mt-4">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by Holiday Name or Description"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Holiday Table */}
      <div className="row mt-1">
        <div className="col-lg-12">
          <div className="card p-4">
            <div className="card-body">
              <h4 className="card-title">View Holidays</h4>
              {loading ? (
                <p className="text-center">Loading holidays...</p>
              ) : (
                <>
                  {/* Pagination Controls */}
                  {filteredRecords.length > pageSize && (
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
                  <div className="table-responsive">
                    <table className="table header-border">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Holiday Name</th>
                          <th>Holiday Date</th>
                          <th>Holiday Description</th>
                          <th>Holiday Created By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentData.length > 0 ? (
                          currentData.map((record, index) => (
                            <tr key={record._id}>
                              <td>{startIndex + index + 1}</td>
                              <td>{record.name || "-"}</td>
                              <td>
                                {record.date
                                  ? new Date(record.date).toLocaleDateString(
                                      "en-GB"
                                    )
                                  : "-"}
                              </td>
                              <td>{record.description || "-"}</td>
                              <td>{record.createdBy?.employeeName || "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" className="text-center">
                              {selectedMonth === ""
                                ? search === ""
                                  ? "No Holidays Found. Please select a Month."
                                  : `No Holidays Found For the Search Term "${search}". Please select a Month.`
                                : search === ""
                                ? `No Holidays Found For the Selected Month ${new Date(
                                    `${selectedMonth}-01`
                                  ).toLocaleString("default", {
                                    month: "long",
                                    year: "numeric",
                                  })}`
                                : `No Holidays Found For the Search Term "${search}" in the Selected Month ${new Date(
                                    `${selectedMonth}-01`
                                  ).toLocaleString("default", {
                                    month: "long",
                                    year: "numeric",
                                  })}`}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination Controls */}
                  {filteredRecords.length > pageSize && (
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
      <center className="card py-5" style={{ visibility: "hidden" }}>
        <div className="row"></div>
      </center>
    </div>
  );
};

export default ViewHolidays;