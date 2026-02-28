import { API_URL } from '../services/api';
import React, { useState } from 'react';
import axios from 'axios';

const Login = () => {
    const [childId, setChildId] = useState('');
    const [childData, setChildData] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!childId.trim()) {
            setErrorMsg('Please enter a Child ID.');
            return;
        }

        setIsSearching(true);
        setErrorMsg('');
        setChildData(null);

        try {
            const response = await axios.get(`${API_URL}/children/lookup/${childId.trim()}`);
            setChildData(response.data);
        } catch (err) {
            if (err.response && err.response.status === 404) {
                setErrorMsg('Child ID not found in database.');
                // Log failed attempt silently
                axios.post(API_URL + '/sessions/fail', { attemptedChildId: childId.trim() }).catch(e => console.error(e));
            } else {
                setErrorMsg('Error connecting to the server.');
            }
        } finally {
            setIsSearching(false);
        }
    };

    const handleGoToAssessment = async () => {
        if (childData) {
            try {
                const response = await axios.post(API_URL + '/sessions/start', { childId: childData.child_id });
                const sessionId = response.data.sessionId;

                localStorage.setItem('currentChild', JSON.stringify(childData));
                localStorage.setItem('sessionId', sessionId);

                // Force whole application reload to update Navbar state cleanly
                window.location.href = '/';
            } catch (err) {
                console.error('Could not start session:', err);
                setErrorMsg('Could not establish a secure session. Please try again.');
            }
        }
    };

    return (
        <main className="main-shell">
            <section className="login-shell">
                <div className="login-card">
                    <div className="login-left">
                        <div className="login-pill">Child lookup for assessment</div>
                        <h1 className="login-heading">
                            Search a child<br />
                            <span>and start the assessment</span>
                        </h1>
                        <p className="login-text">
                            Use the unique Child ID to quickly bring up the child’s details. Once you confirm
                            the record, you can continue to the assessment dashboard.
                        </p>
                        <ul className="login-bullets">
                            <li>Enter the Child ID assigned at registration</li>
                            <li>Verify name, gender, date of birth & mobile number</li>
                            <li>Click <strong>Go to Assessment</strong> to launch the test dashboard</li>
                        </ul>
                        <p className="login-hint">Demo tip: in this front-end demo, try registering a Child ID first.</p>
                    </div>

                    <div className="login-right">
                        <form className="login-form" onSubmit={handleSearch}>
                            <div className="form-group">
                                <label htmlFor="childId">Child ID<span className="required">*</span></label>
                                <div className="child-id-row">
                                    <input
                                        type="text"
                                        id="childId"
                                        value={childId}
                                        onChange={(e) => setChildId(e.target.value)}
                                        placeholder="Enter Child ID (e.g., CH001)"
                                        className={errorMsg ? 'input-error' : ''}
                                    />
                                    <button type="submit" className="btn modal-btn-primary" disabled={isSearching} style={{ padding: '8px 20px', borderRadius: '10px' }}>
                                        {isSearching ? 'Searching...' : 'Search'}
                                    </button>
                                </div>
                                {errorMsg && <p className="field-error">{errorMsg}</p>}
                            </div>
                        </form>

                        <div className="child-details-card">
                            <div className="child-details-header">
                                <h2>Child details</h2>
                                <span className="child-details-status">
                                    {childData ? 'Search using a Child ID above to view the child\'s basic information.' : 'No child selected'}
                                </span>
                            </div>

                            <div className="child-details-grid" style={{ marginTop: '10px' }}>
                                <div className="form-group compact">
                                    <label>Name</label>
                                    <input type="text" readOnly disabled value={childData?.name || ''} style={{ backgroundColor: '#f9fafb', color: '#6b7280' }} />
                                </div>
                                <div className="form-group compact">
                                    <label>Gender</label>
                                    <input type="text" readOnly disabled value={childData?.gender ? childData.gender.charAt(0).toUpperCase() + childData.gender.slice(1) : ''} style={{ backgroundColor: '#f9fafb', color: '#6b7280' }} />
                                </div>
                                <div className="form-group compact">
                                    <label>Date of Birth</label>
                                    <input type="text" readOnly disabled value={childData?.dob ? new Date(childData.dob).toLocaleDateString('en-GB') : ''} style={{ backgroundColor: '#f9fafb', color: '#6b7280' }} />
                                </div>
                                <div className="form-group compact">
                                    <label>Mobile Number</label>
                                    <input type="text" readOnly disabled value={childData?.mobile || ''} style={{ backgroundColor: '#f9fafb', color: '#6b7280' }} />
                                </div>
                            </div>
                        </div>

                        <div className="login-actions">
                            <button
                                type="button"
                                className="btn form-btn-primary"
                                disabled={!childData}
                                onClick={handleGoToAssessment}
                                style={{ padding: '10px 20px' }}
                            >
                                Go to Assessment
                            </button>
                            <a href="/" className="form-link">Back to test hub</a>
                        </div>

                        <p className="form-note" style={{ marginTop: '16px' }}>
                            By registering this child, you confirm that consent has been obtained as per your institution’s policy and that assessments will be supervised by trained staff.
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default Login;
