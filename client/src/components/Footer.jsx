import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const Footer = () => {
    const { t } = useLanguage();
    return (
        <footer className="app-footer">
            {t('footer.copyright')}
        </footer>
    );
};

export default Footer;
