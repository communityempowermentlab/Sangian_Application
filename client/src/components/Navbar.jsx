import { API_URL } from '../services/api';
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Navbar = () => {
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const userStr = localStorage.getItem('currentChild');
        if (userStr) {
            setCurrentUser(JSON.parse(userStr));
        }
    }, []);

    const handleLogout = async () => {
        try {
            const sessionId = localStorage.getItem('sessionId');
            if (sessionId) {
                // Silently execute session dump
                await axios.post(`${API_URL}/sessions/end/${sessionId}`);
            }
        } catch (e) {
            console.error("Logout session error:", e);
        } finally {
            localStorage.removeItem('currentChild');
            localStorage.removeItem('sessionId');
            setCurrentUser(null);
            window.location.href = '/';
        }
    };

    return (
        <header className="top-nav">
            <div className="nav-left">
                <a href="/" className="nav-left-link">
                    <div className="nav-logo-circle">S</div>
                    <div className="nav-brand-text">
                        <div className="nav-title">Sangian</div>
                        <div className="nav-subtitle">Child Cognitive Test Suite</div>
                    </div>
                </a>
            </div>

            <div className="nav-right">
                {currentUser ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ textAlign: 'right', lineHeight: '1.2' }}>
                            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#111827', display: 'block' }}>{currentUser.name}</span>
                            <span style={{ fontSize: '11px', color: '#6b7280' }}>ID: {currentUser.child_id}</span>
                        </div>
                        <button onClick={handleLogout} className="btn nav-btn-outline" style={{ color: '#ef4444', borderColor: '#fee2e2' }}>Logout</button>
                    </div>
                ) : (
                    <>
                        <a href="/login" className="btn nav-btn-outline">Login</a>
                        <a href="/register" className="btn nav-btn-primary">Register</a>
                    </>
                )}
            </div>
        </header>
    );
};

export default Navbar;
