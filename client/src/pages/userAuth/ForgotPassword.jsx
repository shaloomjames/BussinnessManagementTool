import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import Cookies from 'js-cookie';
import Swal from 'sweetalert2';
import { Link, useNavigate } from 'react-router-dom';

const ForgotPassword = () => {
    const [employeeEmail, setEmployeeEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const body = document.querySelector('body');
        body.setAttribute('data-theme-version', 'light');
    }, []);

    const showErrorAlert = (message) => {
        Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: message,
        });
    };

    const showSuccessAlert = (message) => {
        Swal.fire({
            icon: 'success',
            title: 'Success',
            text: message,
            timer: 3600,
            showConfirmButton: false,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Check submission status first
        if (isSubmitting) {
            Swal.fire({
                icon: 'warning',
                title: 'Request Already Sent',
                text: 'Please wait while we process your previous request',
                timer: 2000,
                showConfirmButton: false
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/employee/forgotpassword`, {
                employeeEmail: employeeEmail.toLowerCase()
            });
            
            showSuccessAlert(response.data.msg);
            
            setTimeout(() => {
                navigate("/login");
            }, 3700);
        } catch (error) {
            const errorMessage = error.response?.data?.err || 
                              error.message || 
                              'Failed to process your request';
            showErrorAlert(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="login-form-bg vh-100" 
            style={{ 
                display: "flex", 
                justifyContent: "center", 
                alignItems: "center", 
                height: "100vh", 
                width: "100vw" 
            }}>
            
            <style>{`
                input::placeholder {
                    color: #000 !important;
                }
            `}</style>

            <div className="container h-100">
                <div className="row justify-content-center h-100">
                    <div className="col-xl-6">
                        <div className="form-input-content">
                            <div className="card login-form mb-0" 
                                style={{ backgroundColor: "rgb(255 255 255 / 35%)" }}>
                                
                                <div className="card-body pt-5">
                                    <div className="text-center">
                                        <h4>
                                            <img src="/images/Primevertex-Logo-01-dark.png" 
                                                width="270px" 
                                                alt="Company Logo" />
                                        </h4>
                                    </div>
                                    
                                    <form className="mt-5 mb-5 login-input" onSubmit={handleSubmit}>
                                        <h4 style={{ color: "black", fontWeight: "500" }}>
                                            Enter your email address to receive a password reset link
                                        </h4>
                                        
                                        <div className="form-group mt-4">
                                            <input
                                                type="email"
                                                className="form-control"
                                                placeholder="Email"
                                                value={employeeEmail}
                                                onChange={(e) => setEmployeeEmail(e.target.value)}
                                                style={{ color: "black" }}
                                                required
                                            />
                                        </div>
                                        
                                        <button
                                            className="btn login-form__btn submit w-100"
                                            type="submit"
                                            style={{ backgroundColor: "#0d6efd" }}
                                            disabled={isSubmitting}>
                                            {isSubmitting ? "Sending..." : "Send Email"}
                                        </button>
                                        
                                        <div className="mt-3 text-center">
                                            <Link to="/login" 
                                                style={{ color: "black", fontWeight: "800" }}>
                                                Back to Login
                                            </Link>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;