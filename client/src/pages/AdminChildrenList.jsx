import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axiosAdmin from '../services/axiosAdmin';
import ChildSessionHistoryModal from '../components/ChildSessionHistoryModal';
import { getChildPhotoOrDefault } from '../services/photoUtils';
import { GAME_CATALOG } from '../utils/reportExportUtils';

const TOTAL_GAMES = GAME_CATALOG.length;

// Profile fields an admin is expected to fill — used to flag data-quality gaps
const REQUIRED_FIELDS = [
    ['photo',       'Photo'],
    ['dob',         'Date of birth'],
    ['mobile',      'Mobile'],
    ['father_name', 'Father name'],
    ['mother_name', 'Mother name'],
    ['gram_sabha',  'Gram Sabha'],
    ['hamlet',      'Hamlet'],
];

const getMissingFields = (child) =>
    REQUIRED_FIELDS.filter(([key]) => !child[key]).map(([, label]) => label);

// Active children untouched (no game activity or login) for this many days need follow-up
const STALE_DAYS = 14;

const lastTouchMs = (child) => {
    const t = Math.max(
        child.last_activity ? new Date(child.last_activity).getTime() : 0,
        child.last_login    ? new Date(child.last_login).getTime()    : 0,
    );
    return t || null;
};

const isStale = (child) => {
    if (child.status !== 'active') return false;
    const t = lastTouchMs(child);
    return !t || (Date.now() - t) > STALE_DAYS * 24 * 60 * 60 * 1000;
};

const completionPct = (child) =>
    child.total_sessions > 0 ? Math.round((child.completed_sessions / child.total_sessions) * 100) : null;

// Age bands — one per registration year (7–16), matching the Admin Analysis
// Age filter. Boundaries are exact-day, not calendar "completed years": band
// "N" covers (dob + (N-1) years, dob + N years] — starts the day after the
// child's (N-1)th birthday and ends on their Nth birthday itself.
const AGE_YEARS = Array.from({ length: 10 }, (_, i) => 7 + i); // [7, 8, ..., 16]
const AGE_BAND_ORDER = ['Under 7', ...AGE_YEARS.map(String), '17+', 'Unknown'];

const addYears = (dob, years) => {
    const d = new Date(dob);
    d.setFullYear(d.getFullYear() + years);
    return d;
};

const ageBandOf = (child) => {
    if (!child.dob) return 'Unknown';
    const dobDate = new Date(child.dob);
    const today = new Date();
    if (today <= addYears(dobDate, 6)) return 'Under 7';
    for (const y of AGE_YEARS) {
        if (today <= addYears(dobDate, y)) return `${y}`;
    }
    return '17+';
};

const GENDER_LABELS = { male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Prefer not to say' };

const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();

    if (days < 0) {
        months--;
        const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        days += prevMonth.getDate();
    }

    if (months < 0) {
        years--;
        months += 12;
    }

    return `${years}y ${months}m ${days}d`;
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
    const [groupFilterIds, setGroupFilterIds] = useState([]);
    const [kpiSegment, setKpiSegment] = useState('all');
    const [demoFilters, setDemoFilters] = useState({ genders: [], ageBands: [], gramSabhas: [], hamlets: [] });
    const [groupOptions, setGroupOptions] = useState([]);
    const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
    const groupDropdownRef = useRef(null);

    const [sessionFilterIds, setSessionFilterIds] = useState(() => {
        try {
            const stored = sessionStorage.getItem('childrenListFilterIds');
            if (stored) {
                sessionStorage.removeItem('childrenListFilterIds');
                return JSON.parse(stored);
            }
        } catch (e) { console.error(e); }
        return null;
    });

    useEffect(() => {
        const handler = (e) => {
            if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target)) {
                setGroupDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggleGroupFilter = (groupId) => {
        setGroupFilterIds(prev =>
            prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
        );
        setCurrentPage(1);
    };

    const groupFilterLabel = groupFilterIds.length === 0
        ? 'All Groups'
        : groupFilterIds.length === 1
            ? (groupFilterIds[0] === 'none' ? 'Ungrouped' : (groupOptions.find(g => String(g.id) === groupFilterIds[0])?.name || '1 Group'))
            : `${groupFilterIds.length} Groups`;
    const [pageSize, setPageSize] = useState(100);
    const [currentPage, setCurrentPage] = useState(1);
    const [goToPageInput, setGoToPageInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedChildForSessions, setSelectedChildForSessions] = useState(null);
    const [generatingReportFor, setGeneratingReportFor] = useState(null);

    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'descending' });

    useEffect(() => {
        fetchChildren();
        axiosAdmin.get('/admin/child-groups')
            .then(res => setGroupOptions(res.data))
            .catch(err => console.error('Failed to fetch child groups:', err));
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

    const matchesSearch = (child) =>
        child.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        child.child_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        child.mobile?.includes(searchTerm);

    const matchesGroup = (child) => {
        if (groupFilterIds.length === 0) return true;
        const ids = (child.group_ids || '').split(',').filter(Boolean);
        if (groupFilterIds.includes('none') && ids.length === 0) return true;
        return ids.some(gid => groupFilterIds.includes(gid));
    };

    const matchesSegment = (child) => {
        switch (kpiSegment) {
            case 'never':    return !child.total_sessions;
            case 'complete': return child.games_completed >= TOTAL_GAMES;
            case 'stale':    return isStale(child);
            case 'issues':   return getMissingFields(child).length > 0;
            default:         return true;
        }
    };

    // A child's value(s) for each KPI dimension ('none'/'Not set' are real facets too)
    const DIMENSIONS = {
        groups:     (c) => { const ids = (c.group_ids || '').split(',').filter(Boolean); return ids.length ? ids : ['none']; },
        genders:    (c) => c.gender || 'Not set',
        ageBands:   (c) => ageBandOf(c),
        gramSabhas: (c) => c.gram_sabha || 'Not set',
        hamlets:    (c) => c.hamlet || 'Not set',
    };

    // `exclude` skips one dimension's own filter — used for facet counts, so a
    // card still shows the counts of options you could add to the selection.
    const matchesDemo = (child, exclude) => (
        (exclude === 'groups'     || matchesGroup(child)) &&
        (exclude === 'genders'    || demoFilters.genders.length === 0    || demoFilters.genders.includes(DIMENSIONS.genders(child))) &&
        (exclude === 'ageBands'   || demoFilters.ageBands.length === 0   || demoFilters.ageBands.includes(DIMENSIONS.ageBands(child))) &&
        (exclude === 'gramSabhas' || demoFilters.gramSabhas.length === 0 || demoFilters.gramSabhas.includes(DIMENSIONS.gramSabhas(child))) &&
        (exclude === 'hamlets'    || demoFilters.hamlets.length === 0    || demoFilters.hamlets.includes(DIMENSIONS.hamlets(child)))
    );

    const matchesSessionFilter = (child) => {
        if (!sessionFilterIds) return true;
        return sessionFilterIds.includes(child.child_id);
    };

    const filteredChildren = children.filter(c => matchesSearch(c) && matchesDemo(c, null) && matchesSegment(c) && matchesSessionFilter(c));

    const facetCounts = (dim) => {
        const counts = new Map();
        children.forEach(c => {
            if (!matchesSearch(c) || !matchesDemo(c, dim) || !matchesSegment(c)) return;
            const keys = DIMENSIONS[dim](c);
            (Array.isArray(keys) ? keys : [keys]).forEach(k => counts.set(k, (counts.get(k) || 0) + 1));
        });
        return counts;
    };

    const chipScope = children.filter(c => matchesSearch(c) && matchesDemo(c, null));
    const kpis = {
        never:    chipScope.filter(c => !c.total_sessions).length,
        complete: chipScope.filter(c => c.games_completed >= TOTAL_GAMES).length,
        stale:    chipScope.filter(isStale).length,
        issues:   chipScope.filter(c => getMissingFields(c).length > 0).length,
        sessions: chipScope.reduce((s, c) => s + (Number(c.total_sessions) || 0), 0),
        completedSessions: chipScope.reduce((s, c) => s + (Number(c.completed_sessions) || 0), 0),
    };
    kpis.sessionCompletionPct = kpis.sessions ? Math.round((kpis.completedSessions / kpis.sessions) * 100) : 0;

    const toggleSegment = (segment) => {
        setKpiSegment(prev => (prev === segment ? 'all' : segment));
        setCurrentPage(1);
    };

    const toggleDemo = (dim, val) => {
        setDemoFilters(prev => ({
            ...prev,
            [dim]: prev[dim].includes(val) ? prev[dim].filter(v => v !== val) : [...prev[dim], val],
        }));
        setCurrentPage(1);
    };

    const anyFilterActive = kpiSegment !== 'all' || groupFilterIds.length > 0 ||
        Object.values(demoFilters).some(arr => arr.length > 0) || searchTerm !== '' || sessionFilterIds;

    const clearAllFilters = () => {
        setKpiSegment('all');
        setGroupFilterIds([]);
        setDemoFilters({ genders: [], ageBands: [], gramSabhas: [], hamlets: [] });
        setSearchTerm('');
        setSessionFilterIds(null);
        setCurrentPage(1);
    };

    const groupNameById = new Map(groupOptions.map(g => [String(g.id), g.name]));

    // Per-dimension card definitions: value entries sorted by count (or fixed order for age/gender)
    const facetCards = [
        { dim: 'groups',     icon: '🗂️', title: 'Groups',     color: '#6366f1', selected: groupFilterIds,        toggle: toggleGroupFilter,
          label: (k) => k === 'none' ? 'Ungrouped' : (groupNameById.get(k) || `Group ${k}`) },
        { dim: 'gramSabhas', icon: '🏛️', title: 'Gram Sabha', color: '#0891b2', selected: demoFilters.gramSabhas, toggle: (v) => toggleDemo('gramSabhas', v),
          label: (k) => k },
        { dim: 'hamlets',    icon: '🏘️', title: 'Hamlet',     color: '#10b981', selected: demoFilters.hamlets,    toggle: (v) => toggleDemo('hamlets', v),
          label: (k) => k },
        { dim: 'ageBands',   icon: '🎂', title: 'Age',        color: '#f59e0b', selected: demoFilters.ageBands,   toggle: (v) => toggleDemo('ageBands', v),
          label: (k) => k === 'Unknown' ? 'Unknown' : `${k} yrs`, order: AGE_BAND_ORDER },
        { dim: 'genders',    icon: '🚻', title: 'Gender',     color: '#8b5cf6', selected: demoFilters.genders,    toggle: (v) => toggleDemo('genders', v),
          label: (k) => GENDER_LABELS[k] || k, order: ['male', 'female', 'other', 'prefer_not_to_say', 'Not set'] },
    ].map(card => {
        const counts = facetCounts(card.dim);
        let entries = [...counts.entries()];
        entries = card.order
            ? card.order.filter(k => counts.has(k)).map(k => [k, counts.get(k)])
            : entries.sort((a, b) => b[1] - a[1]);
        // keep selected values visible even when their current count is 0
        card.selected.forEach(v => { if (!counts.has(v)) entries.push([v, 0]); });
        return { ...card, entries, maxCount: Math.max(1, ...entries.map(([, n]) => n)) };
    });

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key === key) {
            return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
        }
        return ' ↕';
    };

    const sortedChildren = React.useMemo(() => {
        let sortableItems = [...filteredChildren];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];
                
                if (sortConfig.key === 'age') {
                    // Sorting by age implies sorting by Date of Birth in reverse
                    aValue = a.dob ? new Date(a.dob).getTime() : 0;
                    bValue = b.dob ? new Date(b.dob).getTime() : 0;
                    // For age, older is born earlier (smaller timestamp)
                    // If we want ascending age (youngest to oldest), it means descending timestamp
                    if (aValue < bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                    if (aValue > bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                    return 0;
                }
                
                if (['total_sessions', 'completed_sessions', 'games_played', 'games_completed'].includes(sortConfig.key)) {
                    aValue = Number(aValue) || 0;
                    bValue = Number(bValue) || 0;
                }

                if (aValue === null || aValue === undefined) aValue = '';
                if (bValue === null || bValue === undefined) bValue = '';
                
                if (typeof aValue === 'string') aValue = aValue.toLowerCase();
                if (typeof bValue === 'string') bValue = bValue.toLowerCase();
                
                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredChildren, sortConfig]);

    const totalPages = Math.ceil(sortedChildren.length / pageSize) || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const currentChildren = sortedChildren.slice(startIndex, startIndex + pageSize);

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
        
        const headers = ['Child ID', 'Name', 'Date of Birth', 'Age', 'Gender', 'Mobile', 'Father Name', 'Mother Name', 'Gram Sabha', 'Hamlet Name', 'Remarks', 'Groups', `Games Completed (of ${TOTAL_GAMES})`, 'Games Attempted', 'Total Sessions', 'Completed Sessions', 'Session Completion %', 'Last Game Activity', 'Missing Profile Fields', 'Status', 'Last Login'];

        const rows = children.map(child => [
            child.child_id || '',
            `"${child.name || ''}"`,
            child.dob ? new Date(child.dob).toISOString().split('T')[0] : '',
            calculateAge(child.dob),
            child.gender || '',
            child.mobile || '',
            `"${child.father_name || ''}"`,
            `"${child.mother_name || ''}"`,
            `"${child.gram_sabha || ''}"`,
            `"${child.hamlet || ''}"`,
            `"${child.remarks || ''}"`,
            `"${child.group_names || ''}"`,
            child.games_completed ?? 0,
            child.games_played ?? 0,
            child.total_sessions ?? 0,
            child.completed_sessions ?? 0,
            completionPct(child) !== null ? `${completionPct(child)}%` : '',
            child.last_activity ? new Date(child.last_activity).toLocaleString() : 'Never',
            `"${getMissingFields(child).join('; ')}"`,
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

    const handleGenerateChildReport = async (child) => {
        setGeneratingReportFor(child.child_id);
        try {
            const XLSX = await import('xlsx');
            const { generateReportData, GAME_CATALOG } = await import('../utils/reportExportUtils');
            
            const wb = XLSX.utils.book_new();
            
            // Fetch reports for all 9 games concurrently
            const promises = GAME_CATALOG.map(async (game) => {
                try {
                    const res = await axiosAdmin.get(`/games/reports/detail/${game.key}?child_id=${child.child_id}`);
                    const detail = { columns: res.data.columns || [], data: res.data.data || [] };
                    
                    const { headers, rows } = generateReportData(game, detail);
                    
                    // Create worksheet
                    let ws;
                    if (headers.length > 0 || rows.length > 0) {
                        const wsData = [headers, ...rows];
                        ws = XLSX.utils.aoa_to_sheet(wsData);
                    } else {
                        ws = XLSX.utils.aoa_to_sheet([['No attempts recorded for this test.']]);
                    }
                    
                    // Add worksheet to workbook
                    XLSX.utils.book_append_sheet(wb, ws, game.title.substring(0, 31)); // Max sheet name length is 31
                } catch (error) {
                    console.error(`Failed to fetch report for ${game.title}`, error);
                    const ws = XLSX.utils.aoa_to_sheet([['Failed to load data for this test']]);
                    XLSX.utils.book_append_sheet(wb, ws, game.title.substring(0, 31));
                }
            });
            
            await Promise.all(promises);
            
            // Generate Excel file
            const childName = child.name ? child.name.replace(/[^a-zA-Z0-9]/g, '_') : 'Child';
            const fileName = `${childName}_${child.child_id}_Assessment_Report.xlsx`;
            
            XLSX.writeFile(wb, fileName);
            
        } catch (error) {
            console.error('Error generating report:', error);
            alert('Failed to generate report. Please try again.');
        } finally {
            setGeneratingReportFor(null);
        }
    };

    return (
        <main className="admin-content" aria-label="Children List">
            <div className="admin-card w12">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 4px 0' }}>Registered Children (Total: {children.length})</h3>
                        {sessionFilterIds && (
                            <span style={{ fontSize: '13px', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                Showing {sessionFilterIds.length} children from Dashboard
                            </span>
                        )}
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

                {/* Children KPI facets — click any value to filter the table (multi-select) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
                    {facetCards.map(card => (
                        <div key={card.dim} style={{ background: '#fff', border: '1px solid var(--border)', borderTop: `3px solid ${card.color}`, borderRadius: '12px', padding: '10px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700' }}>{card.icon} {card.title} <span style={{ color: 'var(--muted)', fontWeight: '400' }}>({card.entries.length})</span></span>
                                {card.selected.length > 0 && (
                                    <button type="button" onClick={() => card.selected.slice().forEach(v => card.toggle(v))}
                                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '11px', padding: 0 }}>
                                        clear
                                    </button>
                                )}
                            </div>
                            <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '8px' }}>
                                {card.entries.length === 0 ? (
                                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>No data</span>
                                ) : card.entries.map(([val, count]) => {
                                    const on = card.selected.includes(val);
                                    const barPct = Math.round((count / card.maxCount) * 100);
                                    return (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => card.toggle(val)}
                                            title={on ? 'Click to remove filter' : `Filter: ${card.title} = ${card.label(val)}`}
                                            style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
                                                padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12.5px', textAlign: 'left',
                                                border: `1px solid ${on ? card.color : 'transparent'}`,
                                                background: `linear-gradient(90deg, ${card.color}${on ? '2e' : '14'} ${barPct}%, transparent ${barPct}%)`,
                                                fontWeight: on ? '700' : '400', color: 'var(--text)',
                                            }}
                                        >
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.label(val)}</span>
                                            <span style={{ fontWeight: '700', color: card.color }}>{count}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Assessment quick filters + scope summary */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                    {[
                        { seg: 'never',    label: '🚫 Never Assessed',                 n: kpis.never,    color: '#ef4444' },
                        { seg: 'complete', label: `🏁 All ${TOTAL_GAMES} Games Done`,  n: kpis.complete, color: '#10b981' },
                        { seg: 'stale',    label: `⏰ Idle ${STALE_DAYS}+ days`,       n: kpis.stale,    color: '#f59e0b' },
                        { seg: 'issues',   label: '⚠️ Profile Gaps',                   n: kpis.issues,   color: '#b45309' },
                    ].map(chip => {
                        const on = kpiSegment === chip.seg;
                        return (
                            <button key={chip.seg} type="button" onClick={() => toggleSegment(chip.seg)}
                                style={{
                                    padding: '5px 12px', borderRadius: '999px', fontSize: '12px', cursor: 'pointer',
                                    border: `1px solid ${on ? chip.color : 'var(--border)'}`,
                                    background: on ? `${chip.color}1a` : '#fff',
                                    fontWeight: on ? '700' : '500', color: 'var(--text)',
                                }}
                            >
                                {chip.label} <span style={{ fontWeight: '700', color: chip.color }}>{chip.n}</span>
                            </button>
                        );
                    })}
                    <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: 'auto' }}>
                        📊 {filteredChildren.length} children · {kpis.sessions} sessions · {kpis.sessionCompletionPct}% completed
                        {anyFilterActive && (
                            <button type="button" onClick={clearAllFilters} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px', padding: 0, marginLeft: '10px' }}>
                                ✖ Clear all filters
                            </button>
                        )}
                    </span>
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

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div ref={groupDropdownRef} style={{ position: 'relative' }}>
                                    <button
                                        type="button"
                                        aria-label="Filter by group"
                                        onClick={() => setGroupDropdownOpen(o => !o)}
                                        style={{ padding: '10px 12px', borderRadius: '14px', border: '1px solid var(--border)', outline: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', minWidth: '140px', justifyContent: 'space-between' }}
                                    >
                                        <span>{groupFilterLabel}</span>
                                        <span style={{ fontSize: '11px' }}>{groupDropdownOpen ? '▴' : '▾'}</span>
                                    </button>
                                    {groupDropdownOpen && (
                                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20, background: '#fff', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '8px', minWidth: '220px', maxHeight: '260px', overflowY: 'auto' }}>
                                            {groupOptions.length === 0 ? (
                                                <div style={{ padding: '8px', fontSize: '13px', color: 'var(--muted)' }}>No groups yet.</div>
                                            ) : (
                                                <>
                                                    {groupFilterIds.length > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => { setGroupFilterIds([]); setCurrentPage(1); }}
                                                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', fontSize: '12px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '4px' }}
                                                        >
                                                            Clear selection
                                                        </button>
                                                    )}
                                                    {groupOptions.map(g => (
                                                        <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', fontSize: '13px', cursor: 'pointer', borderRadius: '6px' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={groupFilterIds.includes(String(g.id))}
                                                                onChange={() => toggleGroupFilter(String(g.id))}
                                                            />
                                                            {g.name}{g.status !== 'active' ? ' (inactive)' : ''}
                                                        </label>
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

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
                                    <tr style={{ whiteSpace: 'nowrap' }}>
                                        <th>#</th>
                                        <th style={{ width: '56px' }}>Photo</th>
                                        <th onClick={() => requestSort('child_id')} style={{cursor: 'pointer'}}>Child Unique ID{getSortIndicator('child_id')}</th>
                                        <th onClick={() => requestSort('name')} style={{cursor: 'pointer'}}>Child Name{getSortIndicator('name')}</th>
                                        <th onClick={() => requestSort('dob')} style={{cursor: 'pointer'}}>Date of Birth{getSortIndicator('dob')}</th>
                                        <th onClick={() => requestSort('age')} style={{cursor: 'pointer'}}>Age{getSortIndicator('age')}</th>
                                        <th onClick={() => requestSort('gender')} style={{cursor: 'pointer'}}>Gender{getSortIndicator('gender')}</th>
                                        <th onClick={() => requestSort('mobile')} style={{cursor: 'pointer'}}>Mobile{getSortIndicator('mobile')}</th>
                                        <th onClick={() => requestSort('father_name')} style={{cursor: 'pointer'}}>Father{getSortIndicator('father_name')}</th>
                                        <th onClick={() => requestSort('mother_name')} style={{cursor: 'pointer'}}>Mother{getSortIndicator('mother_name')}</th>
                                        <th onClick={() => requestSort('gram_sabha')} style={{cursor: 'pointer'}}>Gram Sabha{getSortIndicator('gram_sabha')}</th>
                                        <th onClick={() => requestSort('hamlet')} style={{cursor: 'pointer'}}>Hamlet{getSortIndicator('hamlet')}</th>
                                        <th onClick={() => requestSort('remarks')} style={{cursor: 'pointer'}}>Remarks{getSortIndicator('remarks')}</th>
                                        <th>Groups</th>
                                        <th onClick={() => requestSort('games_completed')} style={{cursor: 'pointer'}}>Games{getSortIndicator('games_completed')}</th>
                                        <th onClick={() => requestSort('total_sessions')} style={{cursor: 'pointer'}}>Sessions{getSortIndicator('total_sessions')}</th>
                                        <th onClick={() => requestSort('last_activity')} style={{cursor: 'pointer'}}>Last Activity{getSortIndicator('last_activity')}</th>
                                        <th onClick={() => requestSort('created_at')} style={{cursor: 'pointer'}}>Add Date{getSortIndicator('created_at')}</th>
                                        <th onClick={() => requestSort('last_login')} style={{ textAlign: 'left', cursor: 'pointer' }}>Last Login{getSortIndicator('last_login')}</th>
                                        <th onClick={() => requestSort('status')} style={{cursor: 'pointer'}}>Status{getSortIndicator('status')}</th>
                                        <th style={{ minWidth: '180px' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="21" style={{ textAlign: 'center', padding: '20px' }}>Loading children...</td></tr>
                                    ) : currentChildren.length === 0 ? (
                                        <tr><td colSpan="21" style={{ textAlign: 'center', padding: '20px' }}>No children found matching criteria.</td></tr>
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
                                                <td>
                                                    {child.name}
                                                    {getMissingFields(child).length > 0 && (
                                                        <span title={`Missing: ${getMissingFields(child).join(', ')}`} style={{ marginLeft: '6px', cursor: 'help', fontSize: '12px' }}>⚠️</span>
                                                    )}
                                                </td>
                                                {/* Ensure date format visually matches 2018-05-10 safely */}
                                                <td>{child.dob ? new Date(child.dob).toISOString().split('T')[0] : ''}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>{calculateAge(child.dob)}</td>
                                                <td style={{ textTransform: 'capitalize' }}>{child.gender}</td>
                                                <td>{child.mobile}</td>
                                                <td>{child.father_name || '—'}</td>
                                                <td>{child.mother_name || '—'}</td>
                                                <td>{child.gram_sabha || '—'}</td>
                                                <td>{child.hamlet || '—'}</td>
                                                <td>{child.remarks || '—'}</td>
                                                <td>{child.group_names || '—'}</td>
                                                <td style={{ whiteSpace: 'nowrap' }} title={`${child.games_played} of ${TOTAL_GAMES} games attempted, ${child.games_completed} completed`}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '13px', fontWeight: '600', color: child.games_completed >= TOTAL_GAMES ? '#059669' : '#374151' }}>
                                                            {child.games_completed}/{TOTAL_GAMES}
                                                        </span>
                                                        <div style={{ width: '56px', height: '6px', borderRadius: '3px', background: '#e5e7eb', overflow: 'hidden' }}>
                                                            <div style={{ width: `${Math.min(100, (child.games_completed / TOTAL_GAMES) * 100)}%`, height: '100%', borderRadius: '3px', background: child.games_completed >= TOTAL_GAMES ? '#10b981' : '#6366f1' }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }} title={completionPct(child) !== null ? `${child.completed_sessions} of ${child.total_sessions} sessions completed (${completionPct(child)}%)` : 'No sessions yet'}>
                                                    {child.total_sessions > 0 ? (
                                                        <>
                                                            <span style={{ fontWeight: '600' }}>{child.total_sessions}</span>
                                                            <span style={{ color: completionPct(child) >= 70 ? '#059669' : completionPct(child) >= 40 ? '#b45309' : '#dc2626', marginLeft: '6px' }}>
                                                                {completionPct(child)}%✓
                                                            </span>
                                                        </>
                                                    ) : <span style={{ color: '#dc2626' }}>None</span>}
                                                </td>
                                                <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }} title={child.last_activity ? new Date(child.last_activity).toLocaleString() : 'No game activity recorded'}>
                                                    {isStale(child) && <span title={`No activity for ${STALE_DAYS}+ days — needs follow-up`} style={{ marginRight: '4px' }}>⏰</span>}
                                                    {formatRelativeTime(child.last_activity)}
                                                </td>
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
                                                        <Link 
                                                            to={`/admin/children/scoreboard/${child.child_id}`}
                                                            style={{ fontSize: '13px', color: 'var(--text)', textDecoration: 'none', background: 'transparent', border: 'none' }}
                                                        >
                                                            🏆 Scoreboard
                                                        </Link>
                                                        <button 
                                                            onClick={() => handleGenerateChildReport(child)}
                                                            disabled={generatingReportFor === child.child_id}
                                                            style={{ fontSize: '13px', color: 'var(--text)', background: 'transparent', border: 'none', cursor: generatingReportFor === child.child_id ? 'wait' : 'pointer', padding: 0, opacity: generatingReportFor === child.child_id ? 0.5 : 1 }}
                                                        >
                                                            {generatingReportFor === child.child_id ? '⏳ Generating...' : '📊 Report'}
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
