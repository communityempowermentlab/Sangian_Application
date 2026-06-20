import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../services/api';
import { en } from '../locales/en';

// Bundled English copy is kept as the offline/first-paint fallback only — the source of
// truth for all languages (including English) is the admin-managed /api/public/translations
// API, backed by JSON files an admin can edit without a redeploy.
const FALLBACK_TRANSLATIONS = en;

export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState('en');
    const [availableLanguages, setAvailableLanguages] = useState([{ code: 'en', shortCode: 'en', label: 'English', enabled: true }]);
    const [translations, setTranslations] = useState(FALLBACK_TRANSLATIONS);

    const loadTranslations = useCallback(async (shortCode) => {
        try {
            const res = await axios.get(`${API_URL}/public/translations/${shortCode}`);
            setTranslations(res.data);
        } catch {
            // Backend unreachable or language not enabled — keep showing the last loaded copy.
        }
    }, []);

    // On mount: discover enabled languages + default, then load the active language's content.
    useEffect(() => {
        const init = async () => {
            let defaultShortCode = 'en';
            try {
                const res = await axios.get(`${API_URL}/public/translations/languages`);
                setAvailableLanguages(res.data.languages);
                const defaultEntry = res.data.languages.find((l) => l.code === res.data.defaultLanguage);
                if (defaultEntry) defaultShortCode = defaultEntry.shortCode;
            } catch {
                // Keep the single-language fallback list set in useState above.
            }

            const savedLang = localStorage.getItem('appLanguage');
            const initialLang = savedLang || defaultShortCode;
            setLanguage(initialLang);
            loadTranslations(initialLang);
        };
        init();
    }, [loadTranslations]);

    const changeLanguage = (lang) => {
        setLanguage(lang);
        localStorage.setItem('appLanguage', lang);
        loadTranslations(lang);
    };

    const t = (path) => {
        const keys = path.split('.');
        let result = translations;
        for (const key of keys) {
            if (result == null || result[key] === undefined) {
                return path; // fallback
            }
            result = result[key];
        }
        return result;
    };

    return (
        <LanguageContext.Provider value={{ language, changeLanguage, t, availableLanguages }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
