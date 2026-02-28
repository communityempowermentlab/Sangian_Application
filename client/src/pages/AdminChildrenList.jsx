import { API_URL } from '../services/api';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();

    if (today.getDate() < birthDate.getDate()) {
        months--;
    }

    if (months < 0) {
        years--;
        months += 12;
    }

    return `${years} Yrs ${months} Mos`;
};

const AdminChildrenList = () => {
    const [children, setChildren] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [goToPageInput, setGoToPageInput] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchChildren();
    }, []);

    const fetchChildren = async () => {
        try {
            const response = await axios.get(API_URL + '/admin/children');
            setChildren(response.data);
        } catch (error) {
            console.error('Failed to fetch children:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredChildren = children.filter(child =>
        child.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        child.child_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        child.mobile?.includes(searchTerm)
    );

    const totalPages = Math.ceil(filteredChildren.length / pageSize) || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const currentChildren = filteredChildren.slice(startIndex, startIndex + pageSize);

    const handlePageSelect = (size) => {
        setPageSize(Number(size));
        setCurrentPage(1);
    };

    const handleGoToPage = () => {
        const pageNum = parseInt(goToPageInput, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
            setCurrentPage(pageNum);
        }
        setGoToPageInput('');
    };

    return (
        <main className="admin-content" aria-label="Children List">
            <div className="admin-card w12">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>Registered Children (Total: {children.length})</h3>
                        <p style={{ margin: '0', color: 'var(--muted)', fontSize: '13px' }}>List of all registered children. Search and pagination work on UI data for now.</p>
                    </div>
                    <div className="admin-actions">
                        <Link to="/admin/children/add" className="admin-btn admin-btn-primary" style={{ padding: '8px 16px' }}>
                            ➕ Add New Child
                        </Link>
                    </div>
                </div>

                <div className="admin-grid" style={{ marginTop: '12px' }}>
                    <div className="admin-card w12" style={{ boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>

                        {/* Toolbar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                            <div className="admin-search" style={{ minWidth: 'min(520px, 100%)' }}>
                                <input
                                    type="search"
                                    placeholder="Search by name / mobile / unique id..."
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                />
                                <button className="admin-btn admin-btn-ghost" style={{ padding: '8px 12px' }}>🔎</button>
                                {searchTerm && (
                                    <button className="admin-btn admin-btn-ghost" onClick={() => setSearchTerm('')} style={{ padding: '8px 12px' }}>✖</button>
                                )}
                            </div>

                            <div>
                                <select
                                    aria-label="Page size"
                                    style={{ padding: '10px 12px', borderRadius: '14px', border: '1px solid var(--border)', outline: 'none' }}
                                    value={pageSize}
                                    onChange={(e) => handlePageSelect(e.target.value)}
                                >
                                    <option value="5">5 / page</option>
                                    <option value="10">10 / page</option>
                                    <option value="20">20 / page</option>
                                    <option value="50">50 / page</option>
                                </select>
                            </div>
                        </div>

                        {/* Data Table */}
                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table" aria-label="Children Table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Child Unique ID</th>
                                        <th>Child Name</th>
                                        <th>Date of Birth</th>
                                        <th>Age</th>
                                        <th>Gender</th>
                                        <th>Mobile</th>
                                        <th>Status</th>
                                        <th style={{ minWidth: '180px' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="10" style={{ textAlign: 'center', padding: '20px' }}>Loading children...</td></tr>
                                    ) : currentChildren.length === 0 ? (
                                        <tr><td colSpan="10" style={{ textAlign: 'center', padding: '20px' }}>No children found matching criteria.</td></tr>
                                    ) : (
                                        currentChildren.map((child, index) => (
                                            <tr key={child.child_id}>
                                                <td>{startIndex + index + 1}</td>
                                                <td style={{ fontWeight: '600' }}>{child.child_id}</td>
                                                <td>{child.name}</td>
                                                {/* Ensure date format visually matches 2018-05-10 safely */}
                                                <td>{child.dob ? new Date(child.dob).toISOString().split('T')[0] : ''}</td>
                                                <td>{calculateAge(child.dob)}</td>
                                                <td style={{ textTransform: 'capitalize' }}>{child.gender}</td>
                                                <td>{child.mobile}</td>
                                                <td>
                                                    {child.status === 'active' ? (
                                                        <span className="admin-tag good">Active</span>
                                                    ) : (
                                                        <span className="admin-tag warn" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>Inactive</span>
                                                    )}
                                                </td>
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <Link to={`/admin/children/edit/${child.child_id}`} className="admin-btn admin-btn-ghost" style={{ padding: '6px 12px', fontSize: '12px' }}>
                                                            ✏️ Edit
                                                        </Link>
                                                        <button className="admin-btn admin-btn-ghost" style={{ padding: '6px 12px', fontSize: '12px' }}>
                                                            🏆 Scoreboard
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {!loading && (
                            <div className="admin-pager" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <button
                                        className="admin-page-btn"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    >← Prev</button>
                                    <button
                                        className="admin-page-btn"
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    >Next →</button>
                                    <span style={{ fontSize: '13px', color: 'var(--muted)', marginLeft: '10px' }}>
                                        Showing {filteredChildren.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + pageSize, filteredChildren.length)} of {filteredChildren.length} • Page {currentPage}/{totalPages}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Go to page:</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max={totalPages}
                                        value={goToPageInput}
                                        onChange={(e) => setGoToPageInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleGoToPage(); }}
                                        style={{ width: '70px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', outline: 'none' }}
                                    />
                                    <button className="admin-page-btn" onClick={handleGoToPage}>Go</button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </main>
    );
};

export default AdminChildrenList;
