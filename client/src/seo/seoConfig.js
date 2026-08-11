// ─── Global SEO Configuration ─────────────────────────────────────────────────
// Central source of truth for all page-level SEO metadata.
// The SEOManager in App.js reads this on every route change.
// Individual pages (e.g. CmsPublicPage) can override via useSEO() directly.

const SITE_NAME = 'Community Empowerment Lab';

// Resolved at runtime so it works in any deployment environment.
export const SITE_URL = process.env.REACT_APP_SITE_URL
    || (typeof window !== 'undefined' ? window.location.origin : '');

const OG_IMAGE = `${SITE_URL}/cel_admin_logo.png`;

// ─── Global defaults (fallback when a route has no entry) ─────────────────────
export const SEO_DEFAULTS = {
    title:       `Sangian | ${SITE_NAME}`,
    description: 'Sangian is a child assessment platform by Community Empowerment Lab that evaluates cognitive, literacy, and numeracy skills through interactive games designed for early childhood education.',
    keywords:    'sangian, child assessment, cognitive skills, community empowerment lab, early childhood education, CEL, India, literacy, numeracy',
    robots:      'index,follow',
    og: {
        type:        'website',
        title:       `Sangian | ${SITE_NAME}`,
        description: 'Sangian is a child assessment platform by Community Empowerment Lab.',
        image:       OG_IMAGE,
        siteName:    SITE_NAME,
    },
    twitter: {
        card:        'summary_large_image',
        title:       `Sangian | ${SITE_NAME}`,
        description: 'Sangian is a child assessment platform by Community Empowerment Lab.',
        image:       OG_IMAGE,
    },
    jsonLd: {
        '@context': 'https://schema.org',
        '@type':    'Organization',
        name:       SITE_NAME,
        url:        SITE_URL,
        logo:       OG_IMAGE,
        description: 'Community Empowerment Lab develops child assessment tools for early childhood education in India.',
    },
};

// ─── Per-route overrides ───────────────────────────────────────────────────────
// Only define what differs from SEO_DEFAULTS. The SEOManager deep-merges these.
export const ROUTE_SEO = {

    '/': {
        title:       `Home | ${SITE_NAME}`,
        description: 'Welcome to Sangian — an interactive assessment platform for children. Evaluate cognitive, literacy, and numeracy development through engaging games.',
        keywords:    'sangian home, child assessment games, cognitive development, literacy games, numeracy games, community empowerment lab',
        robots:      'index,follow',
        og: {
            title:       `Home | ${SITE_NAME}`,
            description: 'Welcome to Sangian — an interactive child assessment platform by Community Empowerment Lab.',
        },
        twitter: {
            title:       `Home | ${SITE_NAME}`,
            description: 'Welcome to Sangian — an interactive child assessment platform by Community Empowerment Lab.',
        },
        jsonLd: [
            {
                '@context': 'https://schema.org',
                '@type':    'Organization',
                name:       SITE_NAME,
                url:        SITE_URL,
                logo:       OG_IMAGE,
                description: 'Community Empowerment Lab develops child assessment tools for early childhood education in India.',
            },
            {
                '@context':           'https://schema.org',
                '@type':              'WebApplication',
                name:                 'Sangian Assessment Platform',
                url:                  SITE_URL,
                applicationCategory: 'EducationalApplication',
                operatingSystem:     'Web',
                inLanguage:          ['en', 'hi'],
                description:         "Digital assessment platform for children's cognitive, literacy, and numeracy skills.",
                offers: {
                    '@type': 'Offer',
                    price:   '0',
                    priceCurrency: 'INR',
                },
            },
        ],
    },

    '/login': {
        title:       `Login | ${SITE_NAME}`,
        description: 'Log in to access the Sangian child assessment platform.',
        robots:      'noindex,follow',
        og:      { title: `Login | ${SITE_NAME}` },
        twitter: { title: `Login | ${SITE_NAME}` },
        jsonLd:  null,
    },

    '/register': {
        title:       `Register | ${SITE_NAME}`,
        description: 'Create an account to use the Sangian assessment platform.',
        robots:      'noindex,follow',
        og:      { title: `Register | ${SITE_NAME}` },
        twitter: { title: `Register | ${SITE_NAME}` },
        jsonLd:  null,
    },

    '/terms-conditions': {
        title:       `Terms & Conditions | ${SITE_NAME}`,
        description: 'Read the Terms & Conditions governing the use of the Sangian assessment platform by Community Empowerment Lab.',
        keywords:    'terms and conditions, sangian terms, community empowerment lab policy',
        robots:      'index,follow',
        og:      { title: `Terms & Conditions | ${SITE_NAME}` },
        twitter: { title: `Terms & Conditions | ${SITE_NAME}` },
    },

    '/privacy-policy': {
        title:       `Privacy Policy | ${SITE_NAME}`,
        description: 'Learn how Community Empowerment Lab collects, uses, and protects your data on the Sangian platform.',
        keywords:    'privacy policy, data protection, sangian privacy, community empowerment lab',
        robots:      'index,follow',
        og:      { title: `Privacy Policy | ${SITE_NAME}` },
        twitter: { title: `Privacy Policy | ${SITE_NAME}` },
    },

    '/contact-us': {
        title:       `Contact Us | ${SITE_NAME}`,
        description: 'Get in touch with Community Empowerment Lab. Find our address, phone, and email details.',
        keywords:    'contact community empowerment lab, sangian contact, CEL support',
        robots:      'index,follow',
        og:      { title: `Contact Us | ${SITE_NAME}` },
        twitter: { title: `Contact Us | ${SITE_NAME}` },
    },

    '/help': {
        title:       `Help & Support | ${SITE_NAME}`,
        description: 'Find answers to frequently asked questions about the Sangian assessment platform.',
        keywords:    'sangian help, sangian FAQ, support, community empowerment lab',
        robots:      'index,follow',
        og:      { title: `Help & Support | ${SITE_NAME}` },
        twitter: { title: `Help & Support | ${SITE_NAME}` },
    },

    // ── Admin (semi-public) ──────────────────────────────────────────────────
    '/admin/login': {
        title:   `Admin Login | ${SITE_NAME}`,
        robots:  'noindex,nofollow',
        og:      { title: `Admin Login | ${SITE_NAME}` },
        twitter: { title: `Admin Login | ${SITE_NAME}` },
        jsonLd:  null,
    },

    // ── Game routes (individual entries; caught by pattern in SEOManager too) ─
    '/games/bagiya':            { title: `Bagiya | ${SITE_NAME}`,              robots: 'noindex,follow', jsonLd: null },
    '/games/number_recall':     { title: `Lottery Ka Ticket | ${SITE_NAME}`,   robots: 'noindex,follow', jsonLd: null },
    '/games/chalo_mela_chale':  { title: `Chalo Mela Chalen | ${SITE_NAME}`,   robots: 'noindex,follow', jsonLd: null },
    '/games/dhyan_kahan_hai':   { title: `Dhyan Kahan Hai | ${SITE_NAME}`,     robots: 'noindex,follow', jsonLd: null },
    '/games/her_pher':          { title: `Her Pher | ${SITE_NAME}`,            robots: 'noindex,follow', jsonLd: null },
    '/games/her_pher_v2':       { title: `Her Pher V2 | ${SITE_NAME}`,         robots: 'noindex,follow', jsonLd: null },
    '/games/her_pher_v3':       { title: `Her Pher V3 | ${SITE_NAME}`,         robots: 'noindex,follow', jsonLd: null },
    '/games/number_skill':      { title: `Ankganit | ${SITE_NAME}`,            robots: 'noindex,follow', jsonLd: null },
    '/games/reading_skill':     { title: `Padh ke batao | ${SITE_NAME}`,       robots: 'noindex,follow', jsonLd: null },
    '/games/reading_skill_v2':  { title: `Padh ke batao V2 | ${SITE_NAME}`,    robots: 'noindex,follow', jsonLd: null },
    '/games/rachna':            { title: `Rachna | ${SITE_NAME}`,              robots: 'noindex,follow', jsonLd: null },
    '/games/chor_machaye_shor': { title: `Chor Machaye Shor | ${SITE_NAME}`,   robots: 'noindex,follow', jsonLd: null },
};
