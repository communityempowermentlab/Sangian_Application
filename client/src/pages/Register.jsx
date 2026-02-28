import { API_URL } from '../services/api';
import React, { useState } from 'react';
import axios from 'axios';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        dob: '',
        gender: '',
        mobile: ''
    });
    const [errors, setErrors] = useState({});
    const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Calculate min and max selectable dates
    const today = new Date();

    // Max selectable date (child exactly 8 years old today)
    const maxDateObj = new Date(today.getFullYear() - 8, today.getMonth(), today.getDate());
    const maxDate = maxDateObj.toISOString().split('T')[0];

    // Min selectable date (child exactly 10 years old today)
    const minDateObj = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
    const minDate = minDateObj.toISOString().split('T')[0];

    // Handle Input Changes
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear field-specific error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    // Validate form inputs
    const validateForm = () => {
        const newErrors = {};
        if (!formData.name.trim()) newErrors.name = "Child's name is required.";
        if (!formData.dob) {
            newErrors.dob = "Date of Birth is required.";
        } else {
            const dobDate = new Date(formData.dob);
            const today = new Date();
            let age = today.getFullYear() - dobDate.getFullYear();
            const monthDiff = today.getMonth() - dobDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
                age--;
            }
            if (age < 8 || age >= 11) { // Up to 10 years and 364 days is mathematically 10
                newErrors.dob = "Child's age must be between 8 and 10 years.";
            }
        }

        if (!formData.gender) newErrors.gender = "Please select a gender.";

        const mobileRegex = /^[0-9]{10}$/;
        if (!formData.mobile) {
            newErrors.mobile = "Mobile number is required.";
        } else if (!mobileRegex.test(formData.mobile)) {
            newErrors.mobile = "Enter a valid 10-digit mobile number.";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle Form Submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsSubmitting(true);
        setStatusMsg({ type: '', text: '' });

        try {
            const response = await axios.post(API_URL + '/children/register', formData);
            const generatedId = response.data.childId;
            setStatusMsg({ type: 'success', text: `Child registered successfully! Child ID: ${generatedId}` });
            // Reset form upon success
            setFormData({ name: '', dob: '', gender: '', mobile: '' });
        } catch (err) {
            const errorText = err.response?.data?.message || 'An error occurred during registration. Please try again.';
            setStatusMsg({ type: 'error', text: errorText });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="main-shell">
            <section className="register-shell">
                <div className="register-card">
                    {/* LEFT SIDE: TEXT */}
                    <div className="register-left">
                        <div className="register-pill">Child registration module</div>
                        <h1 className="register-heading">
                            Register the child<br />
                            <span>for Sangian assessment</span>
                        </h1>
                        <p className="register-text">
                            Please enter the details of the child whose cognitive assessment will be done using
                            the Sangian (Kauffman-inspired) test modules. These details help you identify and
                            track the child across sessions.
                        </p>
                        <ul className="register-bullets">
                            <li>Use the child’s full official name wherever possible</li>
                            <li>Confirm date of birth with records before starting the assessment</li>
                            <li>Mobile number can be parent / guardian’s primary contact</li>
                        </ul>
                    </div>

                    {/* RIGHT SIDE: FORM */}
                    <div className="register-right">
                        {/* STATUS MESSAGE BOX */}
                        {statusMsg.text && (
                            <div
                                className="form-success"
                                style={{
                                    display: 'block',
                                    backgroundColor: statusMsg.type === 'error' ? '#fef2f2' : '#ecfdf3',
                                    borderColor: statusMsg.type === 'error' ? '#ef4444' : '#22c55e',
                                    color: statusMsg.type === 'error' ? '#991b1b' : '#166534'
                                }}
                            >
                                {statusMsg.text}
                            </div>
                        )}

                        <form className="register-form" onSubmit={handleSubmit} noValidate>
                            {/* Name */}
                            <div className="form-group">
                                <label htmlFor="name">Child's Full Name<span className="required">*</span></label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Enter child's full name"
                                    className={errors.name ? 'input-error' : ''}
                                    required
                                />
                                <p className="field-error">{errors.name}</p>
                            </div>

                            {/* Date of Birth */}
                            <div className="form-group">
                                <label htmlFor="dob">Date of Birth<span className="required">*</span></label>
                                <input
                                    type="date"
                                    id="dob"
                                    name="dob"
                                    value={formData.dob}
                                    onChange={handleChange}
                                    min={minDate}
                                    max={maxDate}
                                    className={errors.dob ? 'input-error' : ''}
                                    required
                                />
                                <p className="field-error">{errors.dob}</p>
                            </div>

                            {/* Gender */}
                            <div className="form-group">
                                <label htmlFor="gender">Gender<span className="required">*</span></label>
                                <select
                                    id="gender"
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleChange}
                                    className={errors.gender ? 'input-error' : ''}
                                    required
                                >
                                    <option value="">Select gender</option>
                                    <option value="female">Female</option>
                                    <option value="male">Male</option>
                                    <option value="other">Other</option>
                                    <option value="prefer_not_to_say">Prefer not to say</option>
                                </select>
                                <p className="field-error">{errors.gender}</p>
                            </div>

                            {/* Mobile Number */}
                            <div className="form-group">
                                <label htmlFor="mobile">Mobile Number<span className="required">*</span></label>
                                <input
                                    type="tel"
                                    id="mobile"
                                    name="mobile"
                                    value={formData.mobile}
                                    onChange={handleChange}
                                    placeholder="Parent / guardian 10-digit mobile number"
                                    maxLength="10"
                                    className={errors.mobile ? 'input-error' : ''}
                                    required
                                />
                                <small className="field-hint">Use a valid 10-digit mobile number (India).</small>
                                <p className="field-error">{errors.mobile}</p>
                            </div>

                            {/* Submit & Navigation */}
                            <div className="form-actions">
                                <button type="submit" className="btn form-btn-primary" disabled={isSubmitting}>
                                    {isSubmitting ? 'Registering...' : 'Register Child'}
                                </button>
                                <a href="/" className="form-link">Back to test hub</a>
                            </div>

                            <p className="form-note">
                                By registering this child, you confirm that consent has been obtained as per
                                your institution’s policy and that assessments will be supervised by trained staff.
                            </p>
                        </form>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default Register;
