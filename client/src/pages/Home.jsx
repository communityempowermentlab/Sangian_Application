import React, { useState, useEffect } from 'react';
import TestModal from '../components/TestModal';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { getChildPhotoOrDefault } from '../services/photoUtils';
import { isIndividualSession } from '../utils/individualSession';
import '../pages/ReadingSkillGame.css'; // Re-use modal styles

const INDIVIDUAL_TEST_BLOCKED_MESSAGE = 'This test is currently not available for Individual Users. Please try another test.';

const Home = () => {
    const { t, language } = useLanguage();
    const [elementsData, setElementsData] = useState([]);
    
    const SERVER_BASE = API_URL.replace(/\/api$/, '');

    const getElementImage = (gameKey) => {
        const element = elementsData.find(e => e.test_id === gameKey && e.asset_type === 'splash_screen' && e.language === language);
        if (element) {
            if (element.file_path.startsWith('/assets')) {
                return element.file_path;
            }
            return `${SERVER_BASE}${element.file_path}`;
        }
        
        // Fallback for static assets if no element is defined in the database
        const staticAssets = {
            'atlantis_bagiya': '/assets/images/bagiya/bagiya.jpg',
            'number_recall_lottery': '/assets/images/lottery_ka_ticket/lottery_ka_ticket.jpg',
            'number_recall_lottery_v2': '/assets/images/lottery_ka_ticket_V2/lottery_ka_ticket.jpg',
            'rover_mela': '/assets/images/chalo_mela_chale/chalo_mela_chale.jpg',
            'auditory_dhyan': '/assets/images/dhyan_kahan_hai/dhyan_kahan_hai.jpg',
            'working_memory_herpher': '/assets/images/her_pher/her_pher.jpg',
            'working_memory_herpher_v2': '/assets/images/her_pher_v2/her_pher_v2.jpg',
            'working_memory_herpher_v3': '/assets/images/her_pher_v3/her_pher_v3.jpg',
            'numeracy_number_skill': '/assets/images/number_skill/number_skill.jpg',
            'numeracy_number_skill_v2': '/assets/images/number_skill_v2/number_skill.jpg',
            'numeracy_number_skill_v3': '/assets/images/number_skill_v3/number_skill.jpg',
            'literacy_reading_skill': '/assets/images/reading_skill/reading_skill.jpg',
            'literacy_reading_skill_v2': '/assets/images/reading_skill_v2/reading_skill_v2.jpg',
            'cognitive_flex_chor': '/assets/images/chor_machaye_shor/chor_machaye_shor.jpg',
            'triangle_rachna': '/assets/images/rachna/rachna.jpg'
        };
        return staticAssets[gameKey];
    };

    const testModules = [
        {
            id: 1,
            gameKey: 'atlantis_bagiya',
            title: t('home.games.bagiya.title') + " " + t('home.games.bagiya.local'),
            subtitle: t('home.games.bagiya.sub'),
            desc: t('home.games.bagiya.desc'),
            startUrl: "/games/bagiya",
            image: getElementImage('atlantis_bagiya'),
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
            image: getElementImage('number_recall_lottery'),
            shortTitle: t('home.games.lottery.title'),
            local: t('home.games.lottery.local'),
            tag: t('home.games.lottery.tag'),
            tagClass: "test-tag"
        },
        {
            id: 2.1,
            gameKey: 'number_recall_lottery_v2',
            title: t('home.games.lottery.title') + t('common.version2'),
            subtitle: t('home.games.lottery.sub'),
            desc: t('home.games.lottery.desc'),
            startUrl: "/games/number_recall_v2",
            image: getElementImage('number_recall_lottery_v2'),
            shortTitle: t('home.games.lottery.title') + t('common.version2'),
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
            image: getElementImage('rover_mela'),
            shortTitle: t('home.games.mela.title'),
            local: t('home.games.mela.local'),
            tag: t('home.games.mela.tag'),
            tagClass: "test-tag"
        },
        {
            id: 4,
            gameKey: 'auditory_dhyan',
            title: t('home.games.dhyan.title') + " " + t('home.games.dhyan.local'),
            subtitle: t('home.games.dhyan.sub'),
            desc: t('home.games.dhyan.desc'),
            startUrl: "/games/dhyan_kahan_hai",
            image: getElementImage('auditory_dhyan'),
            shortTitle: t('home.games.dhyan.title'),
            local: t('home.games.dhyan.local'),
            tag: t('home.games.dhyan.tag'),
            tagClass: "test-tag"
        },
        {
            id: 5,
            gameKey: 'working_memory_herpher',
            title: t('home.games.herpher.title') + " " + t('home.games.herpher.local'),
            subtitle: t('home.games.herpher.sub'),
            desc: t('home.games.herpher.desc'),
            startUrl: "/games/her_pher",
            image: getElementImage('working_memory_herpher'),
            shortTitle: t('home.games.herpher.title'),
            local: t('home.games.herpher.local'),
            tag: t('home.games.herpher.tag'),
            tagClass: "test-tag"
        },
        {
            id: 5.1,
            gameKey: 'working_memory_herpher_v2',
            title: t('home.games.herpher.title') + t('common.version2') + " " + t('home.games.herpher.local'),
            subtitle: t('home.games.herpher.sub'),
            desc: t('home.games.herpher.desc'),
            startUrl: "/games/her_pher_v2",
            image: getElementImage('working_memory_herpher_v2'),
            shortTitle: t('home.games.herpher.title') + t('common.version2'),
            local: t('home.games.herpher.local'),
            tag: t('home.games.herpher.tag'),
            tagClass: "test-tag"
        },
        {
            id: 5.2,
            gameKey: 'working_memory_herpher_v3',
            title: t('home.games.herpher.title') + t('common.version3') + " " + t('home.games.herpher.local'),
            subtitle: t('home.games.herpher.sub'),
            desc: t('home.games.herpher.desc'),
            startUrl: "/games/her_pher_v3",
            image: getElementImage('working_memory_herpher_v3'),
            shortTitle: t('home.games.herpher.title') + t('common.version3'),
            local: t('home.games.herpher.local'),
            tag: t('home.games.herpher.tag'),
            tagClass: "test-tag"
        },
        {
            id: 6,
            gameKey: 'numeracy_number_skill',
            title: t('home.games.numeracy.title') + ' - V0',
            subtitle: t('home.games.numeracy.sub'),
            desc: t('home.games.numeracy.desc'),
            startUrl: "/games/number_skill",
            image: getElementImage('numeracy_number_skill'),
            shortTitle: t('home.games.numeracy.title') + ' - V0',
            local: t('home.games.numeracy.local'),
            tag: t('home.games.numeracy.tag'),
            tagClass: "test-tag test-tag-academic"
        },
        {
            id: 601,
            gameKey: 'numeracy_number_skill_v2',
            title: t('home.games.numeracy.title') + t('common.version2'),
            subtitle: t('home.games.numeracy.sub'),
            desc: t('home.games.numeracy.desc'),
            startUrl: "/games/number_skill_v2",
            image: getElementImage('numeracy_number_skill_v2'),
            shortTitle: t('home.games.numeracy.title') + t('common.version2'),
            local: t('home.games.numeracy.local'),
            tag: t('home.games.numeracy.tag'),
            tagClass: "test-tag test-tag-academic"
        },
        {
            id: 602,
            gameKey: 'numeracy_number_skill_v3',
            title: t('home.games.numeracy.title') + t('common.version3'),
            subtitle: t('home.games.numeracy.sub'),
            desc: t('home.games.numeracy.desc'),
            startUrl: "/games/number_skill_v3",
            image: getElementImage('numeracy_number_skill_v3'),
            shortTitle: t('home.games.numeracy.title') + t('common.version3'),
            local: t('home.games.numeracy.local'),
            tag: t('home.games.numeracy.tag'),
            tagClass: "test-tag test-tag-academic"
        },
        {
            id: 7,
            gameKey: 'literacy_reading_skill',
            title: t('home.games.literacy.title') + ' - V0',
            subtitle: t('home.games.literacy.sub'),
            desc: t('home.games.literacy.desc'),
            startUrl: "/games/reading_skill",
            image: getElementImage('literacy_reading_skill'),
            shortTitle: t('home.games.literacy.title') + ' - V0',
            local: t('home.games.literacy.local'),
            tag: t('home.games.literacy.tag'),
            tagClass: "test-tag test-tag-academic"
        },
        {
            id: 701,
            gameKey: 'literacy_reading_skill_v2',
            title: t('home.games.literacy.title'),
            subtitle: t('home.games.literacy.sub'),
            desc: t('home.games.literacy.desc'),
            startUrl: "/games/reading_skill_v2",
            image: getElementImage('literacy_reading_skill_v2'),
            shortTitle: t('home.games.literacy.title'),
            local: t('home.games.literacy.local'),
            tag: t('home.games.literacy.tag'),
            tagClass: "test-tag test-tag-academic"
        },
        {
            id: 8,
            gameKey: 'cognitive_flex_chor',
            title: t('home.games.chor.title'),
            subtitle: t('home.games.chor.sub'),
            desc: t('home.games.chor.desc'),
            startUrl: "/games/chor_machaye_shor",
            image: getElementImage('cognitive_flex_chor'),
            shortTitle: t('home.games.chor.title'),
            local: t('home.games.chor.local'),
            tag: t('home.games.chor.tag'),
            tagClass: "test-tag"
        },
        {
            id: 9,
            gameKey: 'triangle_rachna',
            title: t('home.games.rachna.title'),
            subtitle: t('home.games.rachna.sub'),
            desc: t('home.games.rachna.desc'),
            startUrl: "/games/rachna",
            image: getElementImage('triangle_rachna'),
            shortTitle: t('home.games.rachna.title'),
            local: t('home.games.rachna.local'),
            tag: t('home.games.rachna.tag'),
            tagClass: "test-tag"
        }
    ];
    const [modalData, setModalData] = useState({
        isOpen: false,
        title: '',
        subtitle: '',
        description: '',
        startUrl: '',
        blocked: false,
        blockedMessage: ''
    });

    const [summaries, setSummaries]     = useState({});
    const [isLoggedIn, setIsLoggedIn]   = useState(false);
    const [childData, setChildData]     = useState(null);
    const [enabledTests, setEnabledTests] = useState(null); // null = not loaded yet
    // Organization-wise Test Assignment — null = unrestricted (no org, or an
    // org that's never been curated); an array = this child's org has
    // explicitly restricted which tests are available. UX filtering only —
    // startGameSession re-checks this fresh server-side regardless, so a
    // stale/unfetched value here can never grant access it shouldn't.
    const [assignedTests, setAssignedTests] = useState(null);
    // Global Individual User Test Settings — separate, independent gate from
    // Organization-wise Test Assignment above. Unlike assignedTests, a
    // blocked test still shows its card (per spec); only clicking it is
    // intercepted (see openModal). {} = nothing known-blocked yet (fail
    // open) — startGameSession re-checks this fresh server-side regardless.
    const [individualAllowedMap, setIndividualAllowedMap] = useState({});

    useEffect(() => {
        const childStr = localStorage.getItem('currentChild');
        if (childStr) {
            try {
                const child = JSON.parse(childStr);
                if (child.child_id) {
                    setIsLoggedIn(true);
                    setChildData(child);
                    fetchSummaries(child.child_id);
                    axios.get(`${API_URL}/children/assigned-tests/${child.child_id}`)
                        .then(({ data }) => setAssignedTests(data.unrestricted ? null : (data.assignedTests || [])))
                        .catch(() => setAssignedTests(null)); // fail open — real gate is server-side at session start
                }
            } catch (e) {}
        }
        axios.get(`${API_URL}/public/test-config`)
            .then(({ data }) => setEnabledTests(data))
            .catch(() => setEnabledTests({})); // on error, show all games rather than hiding everything

        if (isIndividualSession()) {
            axios.get(`${API_URL}/public/individual-test-access`)
                .then(({ data }) => setIndividualAllowedMap(data || {}))
                .catch(() => setIndividualAllowedMap({})); // fail open — real gate is server-side at session start
        }

        axios.get(`${API_URL}/public/elements`)
            .then(({ data }) => setElementsData(data.elements || []))
            .catch(() => setElementsData([]));
    }, []);

    // Hide any test the admin has disabled via Settings → Test Configuration,
    // AND (separately) any test this child's organization hasn't been
    // assigned. Before the config loads, show everything so the page isn't
    // empty on slow connections.
    const visibleTestModules = enabledTests
        ? testModules
              .filter((test) => enabledTests[test.gameKey]?.enabled !== false)
              .filter((test) => assignedTests === null || assignedTests.includes(test.gameKey))
              .sort((a, b) => {
                  const orderA = enabledTests[a.gameKey]?.display_order ?? 999;
                  const orderB = enabledTests[b.gameKey]?.display_order ?? 999;
                  return orderA - orderB;
              })
        : testModules;


    const fetchSummaries = async (childId) => {
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
                    map[s.game_name] = s;
                });
                setSummaries(map);
            }
        } catch (e) {
            console.error('Fetcher summary error', e);
        }
    };

    const formatDate = (iso) => {
        if (!iso) return t('home.never');
        const d = new Date(iso);
        return d.toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    };

    const openModal = (test) => {
        // Global Individual User Test Settings: the card stays visible and
        // clickable (per spec) — only starting the game is blocked, via this
        // info modal's Start button being replaced with the message below.
        const blocked = isIndividualSession() && individualAllowedMap[test.gameKey] === false;
        setModalData({
            isOpen: true,
            title: test.title,
            subtitle: test.subtitle,
            description: test.desc,
            startUrl: test.startUrl,
            blocked,
            blockedMessage: INDIVIDUAL_TEST_BLOCKED_MESSAGE,
        });
    };

    const closeModal = () => {
        setModalData({ ...modalData, isOpen: false });
    };

    return (
        <main className="main-shell">
            <div className="dashboard-container">
                {/* Full-width Responsive Banner */}
                <header className="dashboard-hero-banner">
                    <div className="banner-content">
                        <h1 className="hero-heading-main">
                            {t('home.welcome')} <span>{t('home.title')}</span>
                        </h1>
                        <p className="hero-text-main">
                            {t('home.desc')}
                        </p>
                    </div>
                </header>

                {/* Full-Width Game Cards Grid Section */}
                <section className="games-showcase-section">
                    <div className="showcase-header">
                        <div className="showcase-title-area">
                            <h2>{t('home.modulesHeader')}</h2>
                            <p>{t('home.modulesSub')}</p>
                        </div>
                        <span className="showcase-badge">{visibleTestModules.length} {t('home.modulesBadge')}</span>
                    </div>

                    <div className="games-grid-layout">
                        {visibleTestModules.map((test) => (
                            <article
                                key={test.id}
                                className="game-card-item"
                                onClick={() => openModal(test)}
                            >
                                <div className="game-card-image-wrap">
                                    <img 
                                        src={test.image} 
                                        alt={`${test.shortTitle} – ${test.local}`} 
                                        onError={(e) => { 
                                            e.target.style.display = 'none'; 
                                            e.target.parentElement.innerHTML = '<div class="fallback-icon">🧩</div>'; 
                                        }} 
                                    />
                                </div>
                                <div className="game-card-details">
                                    <h3 className="game-card-title">{test.shortTitle}</h3>
                                    <p className="game-card-local">{test.local}</p>
                                    {isLoggedIn && (
                                        <div className="game-card-activity">
                                            <div className="card-activity-item">
                                                <span className="activity-label">{t('home.lastPlayed')}</span>
                                                <span className="activity-value">
                                                    {summaries[test.gameKey] ? formatDate(summaries[test.gameKey].last_played_at) : t('home.never')}
                                                </span>
                                            </div>
                                            <div className="card-activity-item">
                                                <span className="activity-label">{t('home.totalSessions')}</span>
                                                <span className="activity-value">
                                                    {summaries[test.gameKey]?.total_attempts || 0}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            </div>

            <TestModal
                {...modalData}
                onClose={closeModal}
            />
        </main>
    );
};

export default Home;
