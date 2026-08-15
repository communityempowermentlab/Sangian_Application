import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

const SERVER_BASE = API_URL.replace(/\/api$/, '');

// Resolves admin-managed audio (Settings/Elements -> Audio Management) for a
// test, by the player's current language — no hardcoded language-to-audio
// mapping in the game pages. getAudioUrl(elementKey, staticFallbackPath):
//   1. this test's audio_elements slot for elementKey, in the current language
//   2. that slot's own fallback_language, if it has one and a file exists
//   3. the platform's default language (Admin > Settings > Languages)
//   4. staticFallbackPath — today's pre-existing bundled file, so a test the
//      Admin hasn't configured yet behaves exactly as before this feature
//   5. null, if none of the above resolve
export function useTestAudio(testId) {
    const { language } = useLanguage();
    const [slots, setSlots] = useState([]);
    const [files, setFiles] = useState([]);
    const [defaultShortCode, setDefaultShortCode] = useState('en');
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!testId) { setReady(true); return; }
        let cancelled = false;
        setReady(false);

        Promise.all([
            axios.get(`${API_URL}/public/audio-elements?test_id=${testId}`),
            axios.get(`${API_URL}/public/elements?test_id=${testId}`),
            axios.get(`${API_URL}/public/translations/languages`),
        ]).then(([slotsRes, filesRes, langRes]) => {
            if (cancelled) return;
            setSlots(slotsRes.data.elements || []);
            setFiles((filesRes.data.elements || []).filter(e => e.asset_type?.startsWith('audio_')));
            const defaultEntry = (langRes.data.languages || []).find(l => l.code === langRes.data.defaultLanguage);
            if (defaultEntry) setDefaultShortCode(defaultEntry.shortCode);
        }).catch(() => {
            // Network/server issue — resolution below just falls through to staticFallbackPath.
        }).finally(() => {
            if (!cancelled) setReady(true);
        });

        return () => { cancelled = true; };
    }, [testId]);

    const getAudioUrl = useCallback((elementKey, staticFallbackPath = null) => {
        const assetType = `audio_${elementKey}`;
        const findByLang = (lang) => files.find(f => f.asset_type === assetType && f.language === lang);
        const slot = slots.find(s => s.element_key === elementKey);

        let file = findByLang(language);
        if (!file && slot?.fallback_language) file = findByLang(slot.fallback_language);
        if (!file) file = findByLang(defaultShortCode);
        if (file) {
            return file.file_path.startsWith('/assets') ? file.file_path : `${SERVER_BASE}${file.file_path}`;
        }
        return staticFallbackPath;
    }, [slots, files, language, defaultShortCode]);

    return { getAudioUrl, ready };
}
