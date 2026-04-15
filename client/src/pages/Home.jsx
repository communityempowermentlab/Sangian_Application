import React, { useState, useEffect } from 'react';
import TestModal from '../components/TestModal';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

const Home = () => {
    const { t } = useLanguage();

    const testModules = [
        {
            id: 1,
            gameKey: 'atlantis_bagiya',
            title: t('home.games.bagiya.title') + " " + t('home.games.bagiya.local'),
            subtitle: t('home.games.bagiya.sub'),
            desc: t('home.games.bagiya.desc'),
            startUrl: "/games/bagiya",
            image: "/assets/images/bagiya/bagiya.jpg",
            shortTitle: t('home.games.bagiya.title'),
            local: t('home.games.bagiya.local'),
            tag: t('home.games.bagiya.tag'),
            tagClass: "test-tag"
        },
        {
            id: 2,
            gameKey: 'number_recall_lottery',
            title: t('home.games.lottery.title') + " " + t('home.games.lottery.local'),
            subtitle: t('home.games.lottery.sub'),
            desc: t('home.games.lottery.desc'),
            startUrl: "/games/number_recall",
            image: "/assets/images/lottery_ka_ticket/lottery_ka_ticket.jpg",
            shortTitle: t('home.games.lottery.title'),
            local: t('home.games.lottery.local'),
            tag: t('home.games.lottery.tag'),
            tagClass: "test-tag"
        },
        {
            id: 3,
            gameKey: 'rover_mela',
            title: t('home.games.mela.title') + " " + t('home.games.mela.local'),
            subtitle: t('home.games.mela.sub'),
            desc: t('home.games.mela.desc'),
            startUrl: "/games/chalo_mela_chale",
            image: "/assets/images/chalo_mela_chale.jpg",
            shortTitle: t('home.games.mela.title'),
            local: t('home.games.mela.local'),
            tag: t('home.games.mela.tag'),
            tagClass: "test-tag"
        },
        {
            id: 4,
            gameKey: 'triangle_rachna',
            title: t('home.games.rachna.title') + " " + t('home.games.rachna.local'),
            subtitle: t('home.games.rachna.sub'),
            desc: t('home.games.rachna.desc'),
            startUrl: "/games/rachna",
            image: "/assets/images/rachna/rachna.jpg",
            shortTitle: t('home.games.rachna.title'),
            local: t('home.games.rachna.local'),
            tag: t('home.games.rachna.tag'),
            tagClass: "test-tag"
        },
        {
            id: 5,
            gameKey: 'auditory_dhyan',
            title: t('home.games.dhyan.title') + " " + t('home.games.dhyan.local'),
            subtitle: t('home.games.dhyan.sub'),
            desc: t('home.games.dhyan.desc'),
            startUrl: "/games/dhyan_kahan_hai",
            image: "/assets/images/dhyan_kahan_hai/dhyan_kahan_hai.jpg",
            shortTitle: t('home.games.dhyan.title'),
            local: t('home.games.dhyan.local'),
            tag: t('home.games.dhyan.tag'),
            tagClass: "test-tag"
        },
        {
            id: 6,
            gameKey: 'working_memory_herpher',
            title: t('home.games.herpher.title') + " " + t('home.games.herpher.local'),
            subtitle: t('home.games.herpher.sub'),
            desc: t('home.games.herpher.desc'),
            startUrl: "/games/her_pher",
            image: "/assets/images/her_pher/her_pher.jpg",
            shortTitle: t('home.games.herpher.title'),
            local: t('home.games.herpher.local'),
            tag: t('home.games.herpher.tag'),
            tagClass: "test-tag"
        },
        {
            id: 7,
            gameKey: 'cognitive_flex_chor',
            title: t('home.games.chor.title') + " " + t('home.games.chor.local'),
            subtitle: t('home.games.chor.sub'),
            desc: t('home.games.chor.desc'),
            startUrl: "/games/chor_machaye_shor",
            image: "/assets/images/chor_machaye_shor.jpg",
            shortTitle: t('home.games.chor.title'),
            local: t('home.games.chor.local'),
            tag: t('home.games.chor.tag'),
            tagClass: "test-tag"
        },
        {
            id: 8,
            gameKey: 'numeracy_number_skill',
            title: t('home.games.numeracy.title'),
            subtitle: t('home.games.numeracy.sub'),
            desc: t('home.games.numeracy.desc'),
            startUrl: "/games/number_skill",
            image: "/assets/images/number_skill.jpg",
            shortTitle: t('home.games.numeracy.title'),
            local: t('home.games.numeracy.local'),
            tag: t('home.games.numeracy.tag'),
            tagClass: "test-tag test-tag-academic"
        },
        {
            id: 9,
            gameKey: 'literacy_reading_skill',
            title: t('home.games.literacy.title'),
            subtitle: t('home.games.literacy.sub'),
            desc: t('home.games.literacy.desc'),
            startUrl: "/games/reading_skill",
            image: "/assets/images/reading_skill.jpg",
            shortTitle: t('home.games.literacy.title'),
            local: t('home.games.literacy.local'),
            tag: t('home.games.literacy.tag'),
            tagClass: "test-tag test-tag-academic"
        }
    ];
    const [modalData, setModalData] = useState({
        isOpen: false,
        title: '',
        subtitle: '',
        description: '',
        startUrl: ''
    });

    const [summaries, setSummaries] = useState({});
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loadingActivities, setLoadingActivities] = useState(false);

    const fetchSummaries = async (childId) => {
        setLoadingActivities(true);
        try {
            const config = {};
            const token = localStorage.getItem('token');
            if (token) {
                config.headers = { Authorization: `Bearer ${token}` };
            }

            const res = await axios.get(`${API_URL}/games/sessions/summaries/${childId}`, config);
            if (res.data.success) {
                const map = {};
                res.data.summaries.forEach(s => {
                    // Casing might be inconsistent in DB records
                    if (s.game_name) {
                        map[s.game_name.toLowerCase().trim()] = s;
                    }
                });
                console.log('App: Game Activities Mapped:', map);
                setSummaries(map);
            }
        } catch (e) {
            console.error('App: Error fetching summaries:', e);
        } finally {
            setLoadingActivities(false);
        }
    };

    useEffect(() => {
        const childStr = localStorage.getItem('currentChild');
        if (childStr) {
            try {
                const child = JSON.parse(childStr);
                if (child.child_id) {
                    setIsLoggedIn(true);
                    fetchSummaries(child.child_id);
                }
            } catch (e) {}
        }
    }, []);



    const formatDate = (iso) => {
        if (!iso) return 'Never';
        const d = new Date(iso);
        return d.toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    };

    const openModal = (test) => {
        setModalData({
            isOpen: true,
            title: test.title,
            subtitle: test.subtitle,
            description: test.desc,
            startUrl: test.startUrl
        });
    };

    const closeModal = () => {
        setModalData({ ...modalData, isOpen: false });
    };

    return (
        <main className="main-shell">
            <section className="hero-shell">
                <div className="hero-left">
                    <div className="hero-pill">{t('home.heroPill')}</div>

                    <h1 className="hero-heading">
                        {t('home.welcome')}<br />
                        <span>{t('home.title')}</span>
                    </h1>

                    <p className="hero-text">
                        {t('home.desc')}
                    </p>

                    <ul className="hero-bullets">
                        <li>{t('home.bullet1')}</li>
                        <li>{t('home.bullet2')}</li>
                        <li>{t('home.bullet3')}</li>
                    </ul>

                    <div className="hero-actions">
                        <a href="/login" className="btn hero-btn-primary">{t('home.startTest')}</a>
                        <a href="/register" className="btn hero-btn-ghost">{t('home.registerChild')}</a>
                    </div>

                    <p className="hero-note">
                        {t('home.warningNote')}
                    </p>
                </div>

                <div className="hero-right">
                    <div className="tests-card">
                        <div className="tests-card-header">
                            <div>
                                <h2>{t('home.modulesHeader')}</h2>
                                <p>{t('home.modulesSub')}</p>
                            </div>
                            <span className="tests-badge">{testModules.length} {t('home.modulesBadge')}</span>
                        </div>

                        <div className="tests-grid">
                            {testModules.map((test) => (
                                <article
                                    key={test.id}
                                    className="test-tile"
                                    onClick={() => openModal(test)}
                                >
                                    <div className="test-image-wrap">
                                        {/* Fallback pattern in case image is missing until it's loaded */}
                                        <img src={test.image} alt={`${test.shortTitle} – ${test.local}`} onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<span style="font-size: 24px;">🧩</span>'; }} />
                                    </div>
                                    <div className="test-info">
                                        <h3>{test.shortTitle}</h3>
                                        <p className="test-local">{test.local}</p>
                                        
                                        {isLoggedIn && (
                                            <div className="test-activity">
                                                {loadingActivities ? (
                                                    <div className="activity-item" style={{ color: '#94a3b8', fontSize: '11px' }}>Updating stats...</div>
                                                ) : (
                                                    <>
                                                        <div className="activity-item">
                                                            <span>Last Played:</span> {summaries[test.gameKey.toLowerCase()] ? formatDate(summaries[test.gameKey.toLowerCase()].last_played_at) : 'Never'}
                                                        </div>
                                                        <div className="activity-item">
                                                            <span>Attempts:</span> {summaries[test.gameKey.toLowerCase()]?.total_attempts || 0} times
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <TestModal
                {...modalData}
                onClose={closeModal}
            />
        </main>
    );
};

export default Home;
