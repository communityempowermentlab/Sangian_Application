import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import ChildSessionHistoryModal from '../components/ChildSessionHistoryModal';
import { getChildPhotoOrDefault } from '../services/photoUtils';

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

const formatRelativeTime = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
    
    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears} year${diffInYears !== 1 ? 's' : ''} ago`;
};

const AdminChildrenList = () => {
    const [children, setChildren] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [pageSize, setPageSize] = useState(100);
    const [currentPage, setCurrentPage] = useState(1);
    const [goToPageInput, setGoToPageInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedChildForSessions, setSelectedChildForSessions] = useState(null);

    useEffect(() => {
        fetchChildren();
    }, []);

    const fetchChildren = async () => {
        try {
            const response = await axiosAdmin.get('/admin/children');
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

    const handleExportCSV = () => {
        if (children.length === 0) return;
        
        const headers = ['Child ID', 'Name', 'Date of Birth', 'Age', 'Gender', 'Mobile', 'Status', 'Last Login'];
        
        const rows = children.map(child => [
            child.child_id || '',
            `"${child.name || ''}"`,
            child.dob ? new Date(child.dob).toISOString().split('T')[0] : '',
            calculateAge(child.dob),
            child.gender || '',
            child.mobile || '',
            child.status || '',
            child.last_login ? new Date(child.last_login).toLocaleString() : 'Never'
        ]);
        
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'children_data_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <main className="admin-content" aria-label="Children List">
            <div className="admin-card w12">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>Registered Children (Total: {children.length})</h3>
                        <p style={{ margin: '0', color: 'var(--muted)', fontSize: '13px' }}>List of all registered children. Search and pagination work on UI data for now.</p>
                    </div>
                    <div className="admin-actions" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <button 
                            onClick={handleExportCSV}
                            style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#ffffff', color: '#374151', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontSize: '14px', transition: 'all 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.background = '#f9fafb'}
                            onMouseOut={e => e.currentTarget.style.background = '#ffffff'}
                        >
                            <span>📥</span> Export CSV
                        </button>
                        <Link to="/admin/children/add" style={{ padding: '11px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', color: '#ffffff', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)', border: 'none', fontSize: '14px', transition: 'all 0.2s' }}
                            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <span style={{ fontSize: '16px' }}>➕</span> Add New Child
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
                                    <option value="25">25 / page</option>
                                    <option value="50">50 / page</option>
                                    <option value="100">100 / page</option>
                                    <option value="200">200 / page</option>
                                </select>
                            </div>
                        </div>

                        {/* Data Table */}
                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table" aria-label="Children Table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th style={{ width: '56px' }}>Photo</th>
                                        <th>Child Unique ID</th>
                                        <th>Child Name</th>
                                        <th>Date of Birth</th>
                                        <th>Age</th>
                                        <th>Gender</th>
                                        <th>Mobile</th>
                                        <th>Add Date</th>
                                        <th style={{ textAlign: 'left' }}>Last Login</th>
                                        <th>Status</th>
                                        <th style={{ minWidth: '180px' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="12" style={{ textAlign: 'center', padding: '20px' }}>Loading children...</td></tr>
                                    ) : currentChildren.length === 0 ? (
                                        <tr><td colSpan="12" style={{ textAlign: 'center', padding: '20px' }}>No children found matching criteria.</td></tr>
                                    ) : (
                                        currentChildren.map((child, index) => (
                                            <tr key={child.child_id}>
                                                <td>{startIndex + index + 1}</td>
                                                <td>
                                                    <img
                                                        src={getChildPhotoOrDefault(child.photo)}
                                                        alt={child.name}
                                                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e0e7ff', display: 'block' }}
                                                        onError={(e) => { e.target.src = getChildPhotoOrDefault(null); }}
                                                    />
                                                </td>
                                                <td style={{ fontWeight: '600' }}>{child.child_id}</td>
                                                <td>{child.name}</td>
                                                {/* Ensure date format visually matches 2018-05-10 safely */}
                                                <td>{child.dob ? new Date(child.dob).toISOString().split('T')[0] : ''}</td>
                                                <td>{calculateAge(child.dob)}</td>
                                                <td style={{ textTransform: 'capitalize' }}>{child.gender}</td>
                                                <td>{child.mobile}</td>
                                                <td style={{ whiteSpace: 'nowrap', color: '#374151', fontSize: '13px' }}>
                                                    {child.created_at
                                                        ? new Date(child.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                        : '—'}
                                                </td>
                                                <td style={{ textAlign: 'left' }}>
                                                    <button
                                                        onClick={() => setSelectedChildForSessions(child.child_id)}
                                                        style={{ background: 'transparent', border: 'none', padding: 0, fontSize: '13px', color: 'var(--primary)', textDecoration: 'underline', cursor: 'pointer', textAlign: 'left' }}
                                                    >
                                                        {formatRelativeTime(child.last_login)}
                                                    </button>
                                                </td>
                                                <td>
                                                    {child.status === 'active' ? (
                                                        <span className="admin-tag good">Active</span>
                                                    ) : (
                                                        <span className="admin-tag warn" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>Inactive</span>
                                                    )}
                                                </td>
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                                        <Link to={`/admin/children/edit/${child.child_id}`} style={{ fontSize: '13px', color: 'var(--text)', textDecoration: 'none', background: 'transparent', border: 'none' }}>
                                                            ✏️ Edit
                                                        </Link>
                                                        <button style={{ fontSize: '13px', color: 'var(--text)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
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
            {selectedChildForSessions && (
                <ChildSessionHistoryModal 
                    childId={selectedChildForSessions} 
                    onClose={() => setSelectedChildForSessions(null)} 
                />
            )}
        </main>
    );
};

export default AdminChildrenList;
