import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../services/api';

const GAME_CATALOG = [
    { key: 'atlantis_bagiya',           icon: '🧠', title: 'Atlantis Game',        local: 'BAGIYA',            color: '#6366f1' },
    { key: 'number_recall_lottery',     icon: '🎟️', title: 'Number Recall',        local: 'LOTTERY KA TICKET', color: '#f59e0b' },
    { key: 'rover_mela',                icon: '🗺️', title: 'Rover Game',           local: 'CHALO MELA CHALE',  color: '#10b981' },
    { key: 'triangle_rachna',           icon: '🔺', title: 'Triangle',             local: 'RACHNA',            color: '#ef4444' },
    { key: 'auditory_dhyan',            icon: '👂', title: 'Auditory Attention',   local: 'DHYAN KAHAN HAI',   color: '#8b5cf6' },
    { key: 'working_memory_herpher',    icon: '🔄', title: 'Working Memory',       local: 'HER PHER',          color: '#0891b2' },
    { key: 'cognitive_flex_chor',       icon: '⚡', title: 'Cognitive Flex',       local: 'CHOR MACHAYE SHOR', color: '#dc2626' },
    { key: 'numeracy_number_skill',     icon: '🔢', title: 'Numeracy Test',        local: 'Number Skills',     color: '#7c3aed' },
    { key: 'literacy_reading_skill',    icon: '📖', title: 'Literacy Test',        local: 'Reading Skills',    color: '#059669' },
];

const NUMERACY_DEFAULT = `# 📦 Numeracy Test – Documentation

## Overview
The Numeracy Test is an academic assessment module that evaluates a child's mathematical ability across four progressive categories.

---

## Categories & Questions

| # | Category | Questions | Scoring | Min Correct |
|---|---|---|---|---|
| 1 | Single Number | Q1–Q10 | Manual (oral) | 4 |
| 2 | Double Number | Q11–Q20 | Manual (oral) | 4 |
| 3 | Subtraction | Q21–Q24 | Auto (written) | 2 |
| 4 | Division | Q25–Q26 | Auto (written) | 1 |

**Total Questions: 26**

---

## Stop Rules
1. **3 Consecutive Wrong Answers** → Test stops immediately.
2. **Category Minimum Not Met** → If a child doesn't meet the minimum correct answers by the end of a category, the test stops.

---

## Game Flow
1. **Splash Screen** – Background audio plays; Start Now button activates after audio ends.
2. **Game Screen** – Questions presented one at a time with per-question timer.
3. **Manual Questions (Cat 1 & 2)** – Assessor marks Correct / Incorrect based on verbal response.
4. **Auto Questions (Cat 3 & 4)** – Child enters answer on-screen via number pad; system auto-scores.
5. **Score Screen** – Final results, performance grid, and behavioral assessment form.

---

## Scoring Logic

### Manual Scoring (Single / Double)
\`\`\`
Assessor clicks [✓ Correct] → score = 1
Assessor clicks [✗ Incorrect] → score = 0
\`\`\`

### Auto Scoring – Subtraction
\`\`\`
if (userAnswer === correctAnswer) → score = 1
else → score = 0
\`\`\`

### Auto Scoring – Division
\`\`\`
if (userQuotient === correctAnswer && userRemainder === correctRemainder) → score = 1
else → score = 0
\`\`\`

---

## Pause & Resume
- **Pause & Save** – Saves current question index, scores, and timer state to the server. Resume popup appears on next visit.
- **Quit & End** – Ends the session permanently. No resume popup on next visit.

---

## Sample Questions Database

\`\`\`json
{
  "categories": [
    { "id": 10, "name": "Single Number", "questionCount": 10, "minCorrect": 4 },
    { "id": 11, "name": "Double Number", "questionCount": 10, "minCorrect": 4 },
    { "id": 12, "name": "Subtraction",   "questionCount": 4,  "minCorrect": 2 },
    { "id": 13, "name": "Division",      "questionCount": 2,  "minCorrect": 1 }
  ],
  "stopRules": { "maxConsecutiveWrong": 3 }
}
\`\`\`

---

## Test Scenarios

### Scenario 1: Early Stop – 3 Consecutive Wrong
Q3 Wrong → Q4 Wrong → Q5 Wrong → **STOP** (3 consecutive wrong)

### Scenario 2: Category Minimum Not Met
Q1–Q10 (Single): 3 correct, 7 wrong → **STOP** (3 < 4 minimum)

### Scenario 3: Complete Test Pass
Q1–Q10: 8 correct → Q11–Q20: 7 correct → Q21–Q24: 3 correct → Q25–Q26: 2 correct → **Score Screen**

---

*Last updated by system on first load.*
`;

const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` } });

const AdminDocs = () => {
    const [selectedGame, setSelectedGame] = useState(GAME_CATALOG[7]); // Default: Numeracy
    const [content, setContent] = useState('');
    const [editContent, setEditContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const [versions, setVersions] = useState([]);
    const [showVersions, setShowVersions] = useState(false);
    const [viewingVersion, setViewingVersion] = useState(null);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [updatedBy, setUpdatedBy] = useState(null);

    const loadDoc = useCallback(async (game) => {
        setIsLoading(true);
        setIsEditing(false);
        setViewingVersion(null);
        setShowVersions(false);
        try {
            const res = await axios.get(`${API_URL}/docs/${game.key}`, authHeader());
            if (res.data.doc) {
                setContent(res.data.doc.content);
                setUpdatedAt(res.data.doc.updated_at);
                setUpdatedBy(res.data.doc.updated_by);
            } else {
                // Seed default content for Numeracy
                const defaultText = game.key === 'numeracy_number_skill' ? NUMERACY_DEFAULT : `# ${game.title}\n\nDocumentation for **${game.title}** (${game.local}) has not been added yet.\n\nClick **Edit** to start writing.`;
                setContent(defaultText);
                setUpdatedAt(null);
                setUpdatedBy(null);
            }
        } catch (e) {
            setContent('⚠️ Failed to load documentation. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDoc(selectedGame);
    }, [selectedGame, loadDoc]);

    const loadVersions = async () => {
        try {
            const res = await axios.get(`${API_URL}/docs/${selectedGame.key}/versions`, authHeader());
            setVersions(res.data.versions || []);
        } catch (e) {
            setVersions([]);
        }
    };

    const handleEdit = () => {
        setEditContent(content);
        setIsEditing(true);
        setViewingVersion(null);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setViewingVersion(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveMsg('');
        const adminUserStr = localStorage.getItem('adminUser');
        const savedBy = adminUserStr ? JSON.parse(adminUserStr).name : 'admin';
        try {
            await axios.put(`${API_URL}/docs/${selectedGame.key}`, { content: editContent, saved_by: savedBy }, authHeader());
            setContent(editContent);
            setIsEditing(false);
            setUpdatedAt(new Date().toISOString());
            setUpdatedBy(savedBy);
            setSaveMsg('✅ Saved successfully!');
            setTimeout(() => setSaveMsg(''), 3000);
        } catch (e) {
            setSaveMsg('❌ Failed to save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleViewVersion = async (ver) => {
        try {
            const res = await axios.get(`${API_URL}/docs/version/${ver.id}`, authHeader());
            setViewingVersion({ ...ver, content: res.data.version.content });
            setIsEditing(false);
        } catch(e) {}
    };

    const handleRestoreVersion = () => {
        if (viewingVersion) {
            setEditContent(viewingVersion.content);
            setViewingVersion(null);
            setIsEditing(true);
        }
    };

    const renderMarkdown = (text) => {
        if (!text) return '';
        return text
            // Code blocks
            .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre style="background:#1e1e2e;color:#cdd6f4;padding:16px;border-radius:8px;overflow-x:auto;font-size:0.82rem;line-height:1.6;"><code>$2</code></pre>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;color:#7c3aed;padding:2px 6px;border-radius:4px;font-size:0.85em;">$1</code>')
            // H1
            .replace(/^# (.+)$/gm, '<h1 style="font-size:1.6rem;font-weight:800;color:#111827;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin:24px 0 16px;">$1</h1>')
            // H2
            .replace(/^## (.+)$/gm, '<h2 style="font-size:1.2rem;font-weight:700;color:#374151;margin:20px 0 10px;">$1</h2>')
            // H3
            .replace(/^### (.+)$/gm, '<h3 style="font-size:1rem;font-weight:700;color:#6b7280;margin:16px 0 8px;">$1</h3>')
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // Horizontal rule
            .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">')
            // Table rows (basic)
            .replace(/^\|(.+)\|$/gm, (match) => {
                const isDivider = match.replace(/[|\-\s:]/g, '') === '';
                if (isDivider) return '';
                const cells = match.slice(1, -1).split('|').map(c => `<td style="padding:8px 12px;border:1px solid #e5e7eb;">${c.trim()}</td>`).join('');
                return `<tr>${cells}</tr>`;
            })
            // Wrap consecutive <tr> in table
            .replace(/((<tr>.*<\/tr>\n?)+)/g, '<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.88rem;">$1</table>')
            // Unordered list items
            .replace(/^[-*] (.+)$/gm, '<li style="margin:4px 0;padding-left:4px;">$1</li>')
            .replace(/((<li.*<\/li>\n?)+)/g, '<ul style="padding-left:24px;margin:8px 0;">$1</ul>')
            // Numbered list items
            .replace(/^\d+\. (.+)$/gm, '<li style="margin:4px 0;padding-left:4px;">$1</li>')
            // Line breaks → paragraph spacing
            .replace(/\n\n/g, '</p><p style="margin:8px 0;">')
            .replace(/>\n/g, '>') // Remove newlines right after HTML closing/opening brackets (like </li>\n, </ul>\n) so they don't become extra <br/>
            .replace(/\n/g, '<br/>'); // Convert remaining inner newlines to visible line breaks
    };

    const fmtDt = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 120px)', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>

            {/* LEFT SIDEBAR */}
            <div style={{ width: '260px', minWidth: '260px', background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Documentation</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827' }}>📄 Game Modules</div>
                </div>
                {GAME_CATALOG.map(game => (
                    <button
                        key={game.key}
                        onClick={() => setSelectedGame(game)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 20px', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                            background: selectedGame.key === game.key ? '#f0f4ff' : 'transparent',
                            borderLeft: selectedGame.key === game.key ? `4px solid ${game.color}` : '4px solid transparent',
                            transition: 'all 0.15s',
                        }}
                    >
                        <span style={{ fontSize: '1.3rem' }}>{game.icon}</span>
                        <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: selectedGame.key === game.key ? game.color : '#374151' }}>{game.title}</div>
                            <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{game.local}</div>
                        </div>
                    </button>
                ))}
            </div>

            {/* RIGHT CONTENT AREA */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                {/* Doc Header */}
                <div style={{ padding: '16px 28px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.5rem' }}>{selectedGame.icon}</span>
                            <div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>{selectedGame.title}</div>
                                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                    {updatedAt ? `Last updated ${fmtDt(updatedAt)} by ${updatedBy}` : 'No saved version yet'}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {saveMsg && <span style={{ fontSize: '0.8rem', color: saveMsg.includes('✅') ? '#065f46' : '#991b1b' }}>{saveMsg}</span>}
                        {viewingVersion && (
                            <>
                                <span style={{ fontSize: '0.75rem', background: '#fef9c3', color: '#854d0e', padding: '3px 10px', borderRadius: '999px', fontWeight: 600 }}>
                                    Viewing v{viewingVersion.id} – {fmtDt(viewingVersion.saved_at)}
                                </span>
                                <button onClick={handleRestoreVersion} style={btnStyle('#f59e0b', '#fff')}>↩ Restore This Version</button>
                                <button onClick={() => setViewingVersion(null)} style={btnStyle('#e5e7eb', '#374151')}>✕ Close</button>
                            </>
                        )}
                        {!viewingVersion && !isEditing && (
                            <>
                                <button
                                    onClick={async () => { setShowVersions(v => { const next = !v; if (next) loadVersions(); return next; }); }}
                                    style={btnStyle('#f1f5f9', '#374151')}
                                >
                                    🕓 History {showVersions ? '▲' : '▼'}
                                </button>
                                <button onClick={handleEdit} style={btnStyle(selectedGame.color, '#fff')}>✏️ Edit</button>
                            </>
                        )}
                        {isEditing && (
                            <>
                                <button onClick={handleCancel} style={btnStyle('#e5e7eb', '#374151')}>Cancel</button>
                                <button onClick={handleSave} disabled={isSaving} style={btnStyle(selectedGame.color, '#fff')}>
                                    {isSaving ? 'Saving…' : '💾 Save'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Version History Panel */}
                {showVersions && !isEditing && (
                    <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 28px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', marginBottom: '8px' }}>VERSION HISTORY</div>
                        {versions.length === 0 ? (
                            <div style={{ fontSize: '0.82rem', color: '#9ca3af', fontStyle: 'italic' }}>No prior versions found for this document.</div>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {versions.map(ver => (
                                    <button key={ver.id} onClick={() => handleViewVersion(ver)} style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: viewingVersion?.id === ver.id ? '#ede9fe' : '#f9fafb', cursor: 'pointer', fontSize: '0.78rem', color: '#374151' }}>
                                        v{ver.id} · {fmtDt(ver.saved_at)} by {ver.saved_by}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Content Area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>Loading documentation…</div>
                    ) : isEditing ? (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>📝 Editing in Markdown. Use **bold**, ## headings, - lists, \`code\`, etc.</div>
                            <textarea
                                value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                style={{
                                    flex: 1, minHeight: '500px', width: '100%', padding: '16px',
                                    border: `2px solid ${selectedGame.color}`, borderRadius: '10px',
                                    fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: '1.7',
                                    background: '#fafafa', color: '#1f2937', resize: 'vertical',
                                    boxSizing: 'border-box', outline: 'none'
                                }}
                            />
                        </div>
                    ) : (
                        <div
                            style={{ maxWidth: '100%', background: '#fff', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', lineHeight: '1.75', color: '#374151', fontSize: '0.92rem' }}
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(viewingVersion ? viewingVersion.content : content) }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

const btnStyle = (bg, color) => ({
    padding: '7px 16px', borderRadius: '7px', border: 'none',
    background: bg, color, fontWeight: 600, fontSize: '0.82rem',
    cursor: 'pointer', transition: 'opacity 0.15s',
});

export default AdminDocs;
