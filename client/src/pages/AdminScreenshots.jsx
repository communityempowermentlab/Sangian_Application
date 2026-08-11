import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../services/api';
import './AdminScreenshots.css';

const SERVER_BASE = API_URL.replace(/\/api$/, '');

const GAMES = [
  { key: 'atlantis_bagiya',        name: 'Bagiya',            nameHi: 'बगिया',          emoji: '🌿' },
  { key: 'number_recall_lottery',  name: 'Lottery Ka Ticket', nameHi: 'लॉटरी का टिकट',  emoji: '🎟️' },
  { key: 'number_recall_lottery_v2', name: 'Lottery Ka Ticket - Version 2', nameHi: 'लॉटरी का टिकट - संस्करण 2', emoji: '🎟️' },
  { key: 'rover_mela',             name: 'Chalo Mela Chalen', nameHi: 'चलो मेला चलें',   emoji: '🎡' },
  { key: 'triangle_rachna',        name: 'Rachna',            nameHi: 'रचना',            emoji: '🔷' },
  { key: 'auditory_dhyan',         name: 'Dhyan Kahan Hai',   nameHi: 'ध्यान कहाँ है',  emoji: '👂' },
  { key: 'working_memory_herpher', name: 'Her Pher',          nameHi: 'हेर फेर',          emoji: '🔄' },
  { key: 'working_memory_herpher_v2', name: 'Her Pher - Version 2', nameHi: 'हेर फेर - संस्करण 2', emoji: '🔄' },
  { key: 'working_memory_herpher_v3', name: 'Her Pher - Version 3', nameHi: 'हेर फेर - संस्करण 3', emoji: '🔄' },
  { key: 'cognitive_flex_chor',    name: 'Chor Machaye Shor', nameHi: 'चोर मचाए शोर',   emoji: '🚔' },
  { key: 'numeracy_number_skill',  name: 'Ankganit',          nameHi: 'अंकगणित',         emoji: '🔢' },
  { key: 'numeracy_number_skill_v2',  name: 'Ankganit - Version 2', nameHi: 'अंकगणित - संस्करण 2', emoji: '🔢' },
  { key: 'numeracy_number_skill_v3',  name: 'Ankganit - Version 3', nameHi: 'अंकगणित - संस्करण 3', emoji: '🔢' },
  { key: 'literacy_reading_skill', name: 'Padh ke batao',     nameHi: 'पढ़ के बताओ',     emoji: '📖' },
  { key: 'literacy_reading_skill_v2', name: 'Padh ke batao - Version 2', nameHi: 'पढ़ के बताओ - संस्करण 2', emoji: '📖' },
];

const SCREEN_TYPES = [
  { value: 'intro',        label: 'Intro / Splash',      labelHi: 'परिचय / स्प्लैश',    icon: '🎬' },
  { value: 'instructions', label: 'Instructions',        labelHi: 'निर्देश',              icon: '📋' },
  { value: 'gameplay',     label: 'Gameplay',            labelHi: 'खेल प्रक्रिया',        icon: '▶️' },
  { value: 'result',       label: 'Result / Score',      labelHi: 'परिणाम / अंक',         icon: '📊' },
  { value: 'assessment',   label: 'Assessment Form',     labelHi: 'मूल्यांकन फ़ॉर्म',     icon: '📝' },
  { value: 'other',        label: 'Other',               labelHi: 'अन्य',                 icon: '📌' },
];

const MANUAL_SECTIONS = [
  {
    type: 'intro',
    title: 'Game Introduction',     titleHi: 'खेल परिचय',
    icon: '🎬',
    desc:   'How the game begins — splash screen and welcome.',
    descHi: 'खेल कैसे शुरू होता है — स्प्लैश स्क्रीन और स्वागत।',
  },
  {
    type: 'instructions',
    title: 'Instructions',          titleHi: 'निर्देश',
    icon: '📋',
    desc:   'Tutorial screens, practice rounds, and teaching questions.',
    descHi: 'ट्यूटोरियल स्क्रीन, अभ्यास राउंड और शिक्षण प्रश्न।',
  },
  {
    type: 'gameplay',
    title: 'Main Gameplay',         titleHi: 'मुख्य खेल प्रक्रिया',
    icon: '▶️',
    desc:   'Core gameplay screens showing question formats and interaction.',
    descHi: 'प्रश्न प्रारूप और इंटरैक्शन दिखाने वाली मुख्य खेल स्क्रीन।',
  },
  {
    type: 'result',
    title: 'Score & Results',       titleHi: 'अंक एवं परिणाम',
    icon: '📊',
    desc:   'Score screen, metrics display, and performance feedback.',
    descHi: 'अंक स्क्रीन, मेट्रिक्स प्रदर्शन और प्रदर्शन प्रतिक्रिया।',
  },
  {
    type: 'assessment',
    title: 'Assessment Form',       titleHi: 'मूल्यांकन फ़ॉर्म',
    icon: '📝',
    desc:   'Post-session behavioral assessment filled by the assessor.',
    descHi: 'सत्र के बाद मूल्यांकनकर्ता द्वारा भरा जाने वाला व्यवहार मूल्यांकन।',
  },
  {
    type: 'other',
    title: 'Additional Screens',    titleHi: 'अतिरिक्त स्क्रीन',
    icon: '📌',
    desc:   'Other notable screens in the game flow.',
    descHi: 'खेल प्रवाह में अन्य उल्लेखनीय स्क्रीन।',
  },
];

const BLANK_FORM = { title: '', description: '', screen_type: 'gameplay', sort_order: 0 };

export default function AdminScreenshots() {
  const [activeGame,    setActiveGame]    = useState(GAMES[0].key);
  const [activeLang,    setActiveLang]    = useState('en');
  const [activeView,    setActiveView]    = useState('screenshots'); // 'screenshots' | 'manual'
  const [screenshots,   setScreenshots]   = useState([]);
  const [manualStatus,  setManualStatus]  = useState({});
  const [loading,       setLoading]       = useState(false);

  // Upload / edit modal
  const [showUpload,    setShowUpload]    = useState(false);
  const [editTarget,    setEditTarget]    = useState(null); // screenshot obj or null
  const [form,          setForm]          = useState(BLANK_FORM);
  const [imageFile,     setImageFile]     = useState(null);
  const [imagePreview,  setImagePreview]  = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [dragOver,      setDragOver]      = useState(false);

  // Lightbox
  const [lightbox,      setLightbox]      = useState(null); // { screenshots, index }

  // Toast
  const [toast,         setToast]         = useState(null);

  // Count per game+lang
  const [counts,        setCounts]        = useState({});

  const fileRef = useRef();
  const token = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ssRes, statusRes] = await Promise.all([
        axios.get(`${API_URL}/screenshots?game_key=${activeGame}&language=${activeLang}`, { headers }),
        axios.get(`${API_URL}/screenshots/manual-status`, { headers }),
      ]);
      setScreenshots(ssRes.data.screenshots || []);

      // Build status map: { 'bagiya:en': { published_at, needs_republish, ... } }
      const map = {};
      for (const s of (statusRes.data.statuses || [])) {
        map[`${s.game_key}:${s.language}`] = s;
      }
      setManualStatus(map);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeGame, activeLang]);

  const loadCounts = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/screenshots`, { headers });
      const all = res.data.screenshots || [];
      const c = {};
      for (const s of all) {
        const k = `${s.game_key}:${s.language}`;
        c[k] = (c[k] || 0) + 1;
      }
      setCounts(c);
    } catch (e) { /* silent */ }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  // ── Derived state ────────────────────────────────────────────────────────────
  const statusKey = `${activeGame}:${activeLang}`;
  const currentStatus = manualStatus[statusKey];
  const publishedScreenshots = screenshots.filter(s => s.publish_status === 'published');

  // ── File selection ────────────────────────────────────────────────────────────
  const handleFileSelect = (file) => {
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  // ── Open Upload Modal ─────────────────────────────────────────────────────────
  const openUpload = () => {
    setEditTarget(null);
    setForm({ ...BLANK_FORM });
    setImageFile(null);
    setImagePreview(null);
    setShowUpload(true);
  };

  // ── Open Edit Modal ───────────────────────────────────────────────────────────
  const openEdit = (ss) => {
    setEditTarget(ss);
    setForm({ title: ss.title, description: ss.description || '', screen_type: ss.screen_type, sort_order: ss.sort_order });
    setImageFile(null);
    setImagePreview(`${SERVER_BASE}${ss.image_path}`);
    setShowUpload(true);
  };

  // ── Save (Upload or Edit) ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) return showToast('Title is required', 'error');
    if (!editTarget && !imageFile) return showToast('Please select an image', 'error');

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('game_key',    activeGame);
      fd.append('language',    activeLang);
      fd.append('screen_type', form.screen_type);
      fd.append('title',       form.title.trim());
      fd.append('description', form.description.trim());
      fd.append('sort_order',  form.sort_order);
      if (imageFile) fd.append('image', imageFile);

      if (editTarget) {
        await axios.put(`${API_URL}/screenshots/${editTarget.id}`, fd, { headers });
        showToast('Screenshot updated');
      } else {
        await axios.post(`${API_URL}/screenshots/upload`, fd, { headers });
        showToast('Screenshot uploaded');
      }
      setShowUpload(false);
      loadAll();
      loadCounts();
    } catch (e) {
      showToast(e?.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = async (ss) => {
    if (!window.confirm(`Delete "${ss.title}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_URL}/screenshots/${ss.id}`, { headers });
      showToast('Screenshot deleted');
      loadAll();
      loadCounts();
    } catch (e) {
      showToast('Delete failed', 'error');
    }
  };

  // ── Publish ───────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (screenshots.length === 0) return showToast('No screenshots to publish', 'error');
    if (!window.confirm(`Publish all ${screenshots.length} screenshot(s) for ${activeGame} (${activeLang.toUpperCase()}) and generate the manual?`)) return;
    try {
      const res = await axios.post(`${API_URL}/screenshots/publish`, { game_key: activeGame, language: activeLang }, { headers });
      showToast(`Manual published — ${res.data.screenshot_count} screenshot(s)`);
      loadAll();
    } catch (e) {
      showToast('Publish failed', 'error');
    }
  };

  // ── Lightbox ──────────────────────────────────────────────────────────────────
  const openLightbox = (list, index) => setLightbox({ list, index });
  const lightboxPrev = () => setLightbox(lb => ({ ...lb, index: (lb.index - 1 + lb.list.length) % lb.list.length }));
  const lightboxNext = () => setLightbox(lb => ({ ...lb, index: (lb.index + 1) % lb.list.length }));

  useEffect(() => {
    const handler = (e) => {
      if (!lightbox) return;
      if (e.key === 'ArrowLeft')  lightboxPrev();
      if (e.key === 'ArrowRight') lightboxNext();
      if (e.key === 'Escape')     setLightbox(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox]);

  // ── Download PDF (manual) ─────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    try {
      const el = document.getElementById('manual-capture-area');
      if (!el) return;
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, backgroundColor: '#0f172a' });
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      const game = GAMES.find(g => g.key === activeGame);
      pdf.save(`${game?.name || activeGame}_manual_${activeLang}.pdf`);
      showToast('PDF downloaded');
    } catch (e) {
      showToast('PDF generation failed', 'error');
    }
  };

  // ── Status display helper ─────────────────────────────────────────────────────
  const renderPublishStatus = () => {
    if (!currentStatus) {
      return <span className="ss-publish-status unpublished">● Not Published</span>;
    }
    if (currentStatus.needs_republish) {
      return <span className="ss-publish-status needs-republish">⚠ Needs Republish</span>;
    }
    const date = currentStatus.published_at ? new Date(currentStatus.published_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    return <span className="ss-publish-status published">✓ Published · {date}</span>;
  };

  const activeGameObj = GAMES.find(g => g.key === activeGame);

  return (
    <div className="ss-page">

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div className="ss-hero">
        <div className="ss-hero-top">
          <div>
            <h1 className="ss-hero-title">
              {activeLang === 'hi' ? '📸 स्क्रीनशॉट लाइब्रेरी एवं गेमप्ले मैनुअल' : '📸 Screenshot Library & Gameplay Manual'}
            </h1>
            <p className="ss-hero-sub">
              {activeLang === 'hi'
                ? 'प्रत्येक खेल और भाषा के लिए स्क्रीनशॉट अपलोड करें, फिर गेमप्ले मैनुअल स्वचालित रूप से तैयार करने के लिए प्रकाशित करें।'
                : 'Upload screenshots per game and language, then publish to auto-generate the gameplay manual.'}
            </p>
          </div>
          <div className="ss-hero-controls">
            <div className="ss-toggle-group">
              <button className={`ss-toggle-btn ${activeLang === 'en' ? 'active' : ''}`} onClick={() => setActiveLang('en')}>🇬🇧 English</button>
              <button className={`ss-toggle-btn ${activeLang === 'hi' ? 'active' : ''}`} onClick={() => setActiveLang('hi')}>🇮🇳 Hindi</button>
            </div>
            <div className="ss-toggle-group">
              <button className={`ss-toggle-btn ${activeView === 'screenshots' ? 'active' : ''}`} onClick={() => setActiveView('screenshots')}>📸 Library</button>
              <button className={`ss-toggle-btn ${activeView === 'manual' ? 'active' : ''}`} onClick={() => setActiveView('manual')}>📖 Manual</button>
            </div>
          </div>
        </div>

        {/* Game Tab Bar */}
        <div className="ss-game-tabs">
          {GAMES.map(g => (
            <button
              key={g.key}
              className={`ss-game-tab ${activeGame === g.key ? 'active' : ''}`}
              onClick={() => setActiveGame(g.key)}
            >
              {g.emoji} {activeLang === 'hi' ? g.nameHi : g.name}
              <span className="ss-tab-count">{counts[`${g.key}:${activeLang}`] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Action Bar ────────────────────────────────────────────────────────── */}
      <div className="ss-action-bar">
        <div className="ss-action-left">
          {renderPublishStatus()}
          {currentStatus && <span style={{ fontSize: '0.75rem', color: '#475569' }}>
            {currentStatus.screenshot_count} screenshot{currentStatus.screenshot_count !== 1 ? 's' : ''} in manual
          </span>}
        </div>
        <div className="ss-action-right">
          {activeView === 'manual' && publishedScreenshots.length > 0 && (
            <button className="ss-btn ss-btn-ghost" onClick={handleDownloadPDF}>
              {activeLang === 'hi' ? '⬇ PDF डाउनलोड करें' : '⬇ Download PDF'}
            </button>
          )}
          {activeView === 'screenshots' && (
            <>
              <button className="ss-btn ss-btn-primary" onClick={openUpload}>
                {activeLang === 'hi' ? '+ स्क्रीनशॉट अपलोड करें' : '+ Upload Screenshot'}
              </button>
              <button
                className="ss-btn ss-btn-success"
                onClick={handlePublish}
                disabled={screenshots.length === 0}
              >
                {activeLang === 'hi' ? '🚀 मैनुअल प्रकाशित करें' : '🚀 Publish Manual'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────────── */}
      <div className="ss-content">

        {/* ── Screenshots View ──────────────────────────────────────────────── */}
        {activeView === 'screenshots' && (
          <>
            {loading && <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>Loading…</div>}
            {!loading && screenshots.length === 0 && (
              <div className="ss-empty">
                <div className="ss-empty-icon">📸</div>
                <h3>{activeLang === 'hi' ? 'अभी तक कोई स्क्रीनशॉट नहीं' : 'No screenshots yet'}</h3>
                <p>
                  {activeLang === 'hi'
                    ? <><strong>{activeGameObj?.nameHi}</strong> के लिए हिंदी में स्क्रीनशॉट अपलोड करें।</>
                    : <>Upload screenshots for <strong>{activeGameObj?.name}</strong> in English to get started.</>
                  }
                </p>
                <button className="ss-btn ss-btn-primary" onClick={openUpload}>
                  {activeLang === 'hi' ? '+ पहला स्क्रीनशॉट अपलोड करें' : '+ Upload First Screenshot'}
                </button>
              </div>
            )}
            {!loading && screenshots.length > 0 && (
              <div className="ss-gallery">
                {screenshots.map((ss, idx) => (
                  <div key={ss.id} className={`ss-card ${ss.publish_status}`}>
                    <div className="ss-card-img-wrap" onClick={() => openLightbox(screenshots, idx)}>
                      <img src={`${SERVER_BASE}${ss.image_path}`} alt={ss.title} />
                      <div className="ss-card-overlay">🔍</div>
                      <span className={`ss-card-badge ${ss.publish_status}`}>
                        {ss.publish_status === 'published' ? '✓ Published' : '✏ Draft'}
                      </span>
                      <span className="ss-screen-type-tag">
                        {SCREEN_TYPES.find(t => t.value === ss.screen_type)?.icon} {ss.screen_type}
                      </span>
                    </div>
                    <div className="ss-card-body">
                      <div className="ss-card-title">{ss.title}</div>
                      {ss.description && <div className="ss-card-desc">{ss.description}</div>}
                      <div className="ss-card-meta">
                        Uploaded {new Date(ss.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        &nbsp;· Order: {ss.sort_order}
                      </div>
                      <div className="ss-card-actions">
                        <button className="ss-card-btn" onClick={() => openEdit(ss)}>✏ Edit</button>
                        <button className="ss-card-btn" onClick={() => openLightbox(screenshots, idx)}>🔍 Preview</button>
                        <button className="ss-card-btn danger" onClick={() => handleDelete(ss)}>🗑</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Manual View ───────────────────────────────────────────────────── */}
        {activeView === 'manual' && (
          <div className="ss-manual" id="manual-capture-area">
            <div className="ss-manual-header">
              <div>
                <h2 className="ss-manual-title">
                  {activeGameObj?.emoji} {activeLang === 'hi' ? activeGameObj?.nameHi : activeGameObj?.name}
                  {activeLang === 'hi' ? ' — गेमप्ले मैनुअल' : ' — Gameplay Manual'}
                </h2>
                <p className="ss-manual-sub">
                  {activeLang === 'hi'
                    ? 'प्रकाशित स्क्रीनशॉट से स्वचालित रूप से तैयार। नए स्क्रीनशॉट जोड़ने के बाद पुनः प्रकाशित करें।'
                    : 'Auto-generated from published screenshots. Republish after adding new screenshots.'}
                </p>
              </div>
              <div className="ss-manual-meta">
                <span className="ss-manual-chip lang">{activeLang === 'en' ? '🇬🇧 English' : '🇮🇳 Hindi'}</span>
                {currentStatus?.published_at && (
                  <span className="ss-manual-chip published">
                    ✓ Published {new Date(currentStatus.published_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                )}
                <span className="ss-manual-chip count">{publishedScreenshots.length} screenshots</span>
              </div>
            </div>

            {publishedScreenshots.length === 0 && (
              <div className="ss-empty">
                <div className="ss-empty-icon">📖</div>
                <h3>{activeLang === 'hi' ? 'मैनुअल अभी प्रकाशित नहीं हुआ' : 'Manual not yet published'}</h3>
                <p>
                  {activeLang === 'hi'
                    ? <> स्क्रीनशॉट अपलोड करें, फिर <strong>मैनुअल प्रकाशित करें</strong> पर क्लिक करें।</>
                    : <>Upload screenshots, then click <strong>Publish Manual</strong> to generate this manual.</>}
                </p>
                <button className="ss-btn ss-btn-primary" onClick={() => setActiveView('screenshots')}>
                  {activeLang === 'hi' ? '← स्क्रीनशॉट लाइब्रेरी पर जाएं' : '← Go to Screenshot Library'}
                </button>
              </div>
            )}

            {publishedScreenshots.length > 0 && MANUAL_SECTIONS.map(section => {
              const sectionScreenshots = publishedScreenshots.filter(s => s.screen_type === section.type);
              if (sectionScreenshots.length === 0) return null;
              const sectionTitle = activeLang === 'hi' ? section.titleHi : section.title;
              const sectionDesc  = activeLang === 'hi' ? section.descHi  : section.desc;
              const screenWord   = activeLang === 'hi' ? 'स्क्रीन' : `screen${sectionScreenshots.length !== 1 ? 's' : ''}`;
              return (
                <div key={section.type} className="ss-manual-section">
                  <div className="ss-manual-section-header">
                    <span className="ss-manual-section-icon">{section.icon}</span>
                    <h3 className="ss-manual-section-title">{sectionTitle}</h3>
                    <span className="ss-manual-section-count">{sectionScreenshots.length} {screenWord}</span>
                  </div>
                  <div style={{ padding: '12px 24px', borderBottom: '1px solid #334155', fontSize: '0.8rem', color: '#64748b' }}>
                    {sectionDesc}
                  </div>
                  <div className="ss-manual-steps">
                    {sectionScreenshots.map((ss, idx) => (
                      <div key={ss.id} className="ss-manual-step">
                        <div className="ss-manual-step-num">{idx + 1}</div>
                        <div className="ss-manual-step-content">
                          <img
                            src={`${SERVER_BASE}${ss.image_path}`}
                            alt={ss.title}
                            className="ss-manual-step-img"
                            onClick={() => openLightbox(publishedScreenshots, publishedScreenshots.indexOf(ss))}
                          />
                          <div className="ss-manual-step-title">{ss.title}</div>
                          {ss.description && <p className="ss-manual-step-desc">{ss.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Upload / Edit Modal ──────────────────────────────────────────────── */}
      {showUpload && (
        <div className="ss-modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="ss-modal" onClick={e => e.stopPropagation()}>
            <h2>{editTarget
              ? (activeLang === 'hi' ? '✏ स्क्रीनशॉट संपादित करें' : '✏ Edit Screenshot')
              : (activeLang === 'hi' ? '📤 स्क्रीनशॉट अपलोड करें' : '📤 Upload Screenshot')}
            </h2>

            {/* Image Upload Zone */}
            <div className="ss-form-group">
              <label className="ss-form-label">
                {activeLang === 'hi' ? 'स्क्रीनशॉट छवि' : 'Screenshot Image'} {!editTarget && '*'}
              </label>
              <div
                className={`ss-upload-zone ${dragOver ? 'drag-over' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
              >
                <input ref={fileRef} type="file" accept="image/*" onChange={e => handleFileSelect(e.target.files[0])} />
                {imagePreview ? (
                  <div className="ss-upload-preview">
                    <img src={imagePreview} alt="preview" />
                  </div>
                ) : (
                  <>
                    <div className="ss-upload-icon">🖼</div>
                    <div className="ss-upload-text">
                      {activeLang === 'hi'
                        ? <>क्लिक करें या यहाँ इमेज खींचें<br /><span style={{ fontSize: '0.75rem' }}>PNG, JPG, WebP · अधिकतम 10MB</span></>
                        : <>Click or drag & drop an image here<br /><span style={{ fontSize: '0.75rem' }}>PNG, JPG, WebP · max 10MB</span></>}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Metadata Fields */}
            <div className="ss-form-group">
              <label className="ss-form-label">{activeLang === 'hi' ? 'शीर्षक *' : 'Title *'}</label>
              <input
                className="ss-form-input"
                value={form.title}
                onChange={e => setForm(f => ({...f, title: e.target.value}))}
                placeholder={activeLang === 'hi' ? 'जैसे: स्वागत स्क्रीन — परिचय' : 'e.g. Splash Screen — Welcome'}
              />
            </div>

            <div className="ss-form-row">
              <div className="ss-form-group">
                <label className="ss-form-label">{activeLang === 'hi' ? 'स्क्रीन प्रकार' : 'Screen Type'}</label>
                <select className="ss-form-select" value={form.screen_type} onChange={e => setForm(f => ({...f, screen_type: e.target.value}))}>
                  {SCREEN_TYPES.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.icon} {activeLang === 'hi' ? t.labelHi : t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ss-form-group">
                <label className="ss-form-label">{activeLang === 'hi' ? 'क्रम संख्या' : 'Sort Order'}</label>
                <input className="ss-form-input" type="number" value={form.sort_order} onChange={e => setForm(f => ({...f, sort_order: parseInt(e.target.value) || 0}))} />
              </div>
            </div>

            <div className="ss-form-group">
              <label className="ss-form-label">
                {activeLang === 'hi' ? 'विवरण (मैनुअल में दिखेगा)' : 'Description (appears in manual)'}
              </label>
              <textarea
                className="ss-form-textarea"
                value={form.description}
                onChange={e => setForm(f => ({...f, description: e.target.value}))}
                placeholder={activeLang === 'hi'
                  ? 'इस स्क्रीन में क्या दिखता है और बच्चा/मूल्यांकनकर्ता क्या करता है…'
                  : 'Describe what this screen shows and what the child/assessor does here…'}
              />
            </div>

            {/* Info row */}
            <div style={{ fontSize: '0.77rem', color: '#475569', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '10px 14px', marginBottom: '4px' }}>
              {activeLang === 'hi' ? 'खेल' : 'Game'}:{' '}
              <strong style={{ color: '#94a3b8' }}>
                {activeLang === 'hi' ? activeGameObj?.nameHi : activeGameObj?.name}
              </strong>
              &nbsp;·&nbsp;
              {activeLang === 'hi' ? 'भाषा' : 'Language'}:{' '}
              <strong style={{ color: '#94a3b8' }}>{activeLang === 'en' ? '🇬🇧 English' : '🇮🇳 हिंदी'}</strong>
            </div>

            <div className="ss-modal-actions">
              <button className="ss-btn ss-btn-ghost" onClick={() => setShowUpload(false)}>
                {activeLang === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button className="ss-btn ss-btn-primary" onClick={handleSave} disabled={saving}>
                {saving
                  ? (activeLang === 'hi' ? 'सहेज रहे हैं…' : 'Saving…')
                  : editTarget
                    ? (activeLang === 'hi' ? '✓ अपडेट करें' : '✓ Update')
                    : (activeLang === 'hi' ? '📤 अपलोड करें' : '📤 Upload')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ─────────────────────────────────────────────────────────── */}
      {lightbox && (
        <div className="ss-lightbox-overlay" onClick={() => setLightbox(null)}>
          <button className="ss-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          <img
            src={`${SERVER_BASE}${lightbox.list[lightbox.index].image_path}`}
            alt={lightbox.list[lightbox.index].title}
            className="ss-lightbox-img"
            onClick={e => e.stopPropagation()}
          />
          <div className="ss-lightbox-caption">
            <strong style={{ color: '#e2e8f0' }}>{lightbox.list[lightbox.index].title}</strong>
            {lightbox.list[lightbox.index].description && (
              <div style={{ marginTop: 4 }}>{lightbox.list[lightbox.index].description}</div>
            )}
            <div style={{ marginTop: 6, color: '#475569', fontSize: '0.75rem' }}>
              {lightbox.index + 1} / {lightbox.list.length} &nbsp;·&nbsp; {lightbox.list[lightbox.index].screen_type}
            </div>
          </div>
          {lightbox.list.length > 1 && (
            <div className="ss-lightbox-nav" onClick={e => e.stopPropagation()}>
              <button onClick={lightboxPrev}>← Prev</button>
              <button onClick={lightboxNext}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`ss-toast ${toast.type}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
        </div>
      )}
    </div>
  );
}
