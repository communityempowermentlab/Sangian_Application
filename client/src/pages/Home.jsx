import React, { useState } from 'react';
import TestModal from '../components/TestModal';

const testModules = [
    {
        id: 1,
        title: "Atlantis Game (BAGIYA)",
        subtitle: "Visual associative learning",
        desc: "Child looks at a set of fun creatures in a 'garden' and later tries to remember where each one was placed. Supports visual learning and associative memory.",
        startUrl: "/games/bagiya",
        image: "/assets/images/bagiya.jpg",
        shortTitle: "Atlantis Game",
        local: "(BAGIYA)",
        tag: "Core visual memory",
        tagClass: "test-tag"
    },
    {
        id: 2,
        title: "Number Recall (LOTTERY KA TICKET)",
        subtitle: "Auditory short-term memory",
        desc: "Child listens to a series of numbers and repeats them in the same order. Supports attention, sequencing, and auditory memory.",
        startUrl: "/games/lottery_ka_ticket",
        image: "/assets/images/lottery_ka_ticket.jpg",
        shortTitle: "Number Recall",
        local: "(LOTTERY KA TICKET)",
        tag: "Core auditory span",
        tagClass: "test-tag"
    },
    {
        id: 3,
        title: "Rover Game (CHALO MELA CHALE)",
        subtitle: "Planning & spatial reasoning",
        desc: "Child plans a path through simple visual mazes, like walking through a fairground map. Supports planning, problem-solving, and spatial skills.",
        startUrl: "/games/chalo_mela_chale",
        image: "/assets/images/chalo_mela_chale.jpg",
        shortTitle: "Rover Game",
        local: "(CHALO MELA CHALE)",
        tag: "Spatial planning",
        tagClass: "test-tag"
    },
    {
        id: 4,
        title: "Triangle (RACHNA)",
        subtitle: "Visual construction",
        desc: "Child builds shapes and patterns using pieces – similar to tangram-style puzzles. Supports visual-spatial organisation and construction ability.",
        startUrl: "/games/rachna",
        image: "/assets/images/rachna.jpg",
        shortTitle: "Triangle",
        local: "(RACHNA)",
        tag: "Construction skills",
        tagClass: "test-tag"
    },
    {
        id: 5,
        title: "Auditory Attention (DHYAN KAHAN HAI)",
        subtitle: "Selective listening & focus",
        desc: "Child responds only when they hear specific target words or sounds in a sequence. Supports selective attention and impulse control.",
        startUrl: "/games/dhyan_kahan_hai",
        image: "/assets/images/dhyan_kahan_hai.jpg",
        shortTitle: "Auditory Attention",
        local: "(DHYAN KAHAN HAI)",
        tag: "Listening focus",
        tagClass: "test-tag"
    },
    {
        id: 6,
        title: "Working Memory (HER PHER)",
        subtitle: "Holding & using information",
        desc: "Child keeps rules or information in mind while answering, sometimes updating them mid-task. Supports mental flexibility and organisation.",
        startUrl: "/games/her_pher",
        image: "/assets/images/her_pher.jpg",
        shortTitle: "Working Memory",
        local: "(HER PHER)",
        tag: "Dynamic memory",
        tagClass: "test-tag"
    },
    {
        id: 7,
        title: "Cognitive Flexibility (CHOR MACHAYE SHOR)",
        subtitle: "Rule switching & inhibition",
        desc: "Child shifts between changing rules (for example responding to colour first, then shape). Supports cognitive flexibility and self-control.",
        startUrl: "/games/chor_machaye_shor",
        image: "/assets/images/chor_machaye_shor.jpg",
        shortTitle: "Cognitive Flexibility",
        local: "(CHOR MACHAYE SHOR)",
        tag: "Rule switching",
        tagClass: "test-tag"
    },
    {
        id: 8,
        title: "Numeracy Test",
        subtitle: "Early maths readiness",
        desc: "Age-appropriate tasks on counting, comparison, and basic operations to understand number sense and school readiness.",
        startUrl: "/games/number_skill",
        image: "/assets/images/number_skill.jpg",
        shortTitle: "Numeracy Test",
        local: "(Number Skills)",
        tag: "Academic – Maths",
        tagClass: "test-tag test-tag-academic"
    },
    {
        id: 9,
        title: "Literacy Test",
        subtitle: "Reading & language",
        desc: "Tasks around letters, simple words, and short passages to gauge basic reading comfort and early literacy.",
        startUrl: "/games/reading_skill",
        image: "/assets/images/reading_skill.jpg",
        shortTitle: "Literacy Test",
        local: "(Reading Skills)",
        tag: "Academic – Language",
        tagClass: "test-tag test-tag-academic"
    }
];

const Home = () => {
    const [modalData, setModalData] = useState({
        isOpen: false,
        title: '',
        subtitle: '',
        description: '',
        startUrl: ''
    });

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
                    <div className="hero-pill">🧠 Kauffman-inspired assessment • For supervised use only</div>

                    <h1 className="hero-heading">
                        Welcome to the<br />
                        <span>Sangian Test Hub</span>
                    </h1>

                    <p className="hero-text">
                        A guided, play-based interface for administering seven Kauffman-style cognitive tests,
                        plus Numeracy and Literacy modules – all on one simple, child-friendly screen.
                    </p>

                    <ul className="hero-bullets">
                        <li>✔ Seven core games mapped to culturally adapted names</li>
                        <li>✔ Quick access to Numeracy &amp; Literacy readiness checks</li>
                        <li>✔ Designed for psychologists, teachers &amp; researchers</li>
                    </ul>

                    <div className="hero-actions">
                        <a href="/login" className="btn hero-btn-primary">Start Assessment</a>
                        <a href="/register" className="btn hero-btn-ghost">Register a Child</a>
                    </div>

                    <p className="hero-note">
                        This digital interface supports structured KABC-style assessments. Always follow your institutional protocol and training.
                    </p>
                </div>

                <div className="hero-right">
                    <div className="tests-card">
                        <div className="tests-card-header">
                            <div>
                                <h2>Test Modules</h2>
                                <p>Tap a card to see what the test measures.</p>
                            </div>
                            <span className="tests-badge">{testModules.length} modules</span>
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
                                        <p className={test.tagClass}>{test.tag}</p>
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
