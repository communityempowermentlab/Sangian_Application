import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const Footer = () => {
    const { t } = useLanguage();
    const current = window.location.pathname;

    const links = [
        { key: 'footer.terms',   href: '/terms-conditions' },
        { key: 'footer.privacy', href: '/privacy-policy'   },
        { key: 'footer.contact', href: '/contact-us'       },
        { key: 'footer.help',    href: '/help'             },
    ];

    return (
        <footer className="app-footer">
            <div className="footer-inner">
                <nav className="footer-nav" aria-label="Footer navigation">
                    {links.map(({ key, href }) => (
                        <a
                            key={href}
                            href={href}
                            className={`footer-link${current === href ? ' footer-link--active' : ''}`}
                        >
                            {t(key)}
                        </a>
                    ))}
                </nav>
                <p className="footer-copy">{t('footer.copyright')}</p>
            </div>
        </footer>
    );
};

export default Footer;
