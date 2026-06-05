import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const Footer = () => {
    const { t } = useLanguage();

    const links = [
        { key: 'footer.terms',   to: '/terms-conditions' },
        { key: 'footer.privacy', to: '/privacy-policy'   },
        { key: 'footer.contact', to: '/contact-us'        },
        { key: 'footer.help',    to: '/help'             },
    ];

    return (
        <footer className="app-footer">
            <div className="footer-inner">
                <nav className="footer-nav" aria-label="Footer navigation">
                    {links.map(({ key, to }) => (
                        <Link key={to} to={to} className="footer-link">
                            {t(key)}
                        </Link>
                    ))}
                </nav>
                <p className="footer-copy">{t('footer.copyright')}</p>
            </div>
        </footer>
    );
};

export default Footer;
