import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

// Resolves admin-managed test CONTENT (Elements -> Test Content) for a test,
// by the player's current language — mirrors useTestAudio.js's exact
// architecture (one fetch at test start, client-side resolution, no
// hardcoded language logic), but for structured text config instead of
// audio file URLs. getContent(elementKey):
//   1. this test's content_<elementKey> row, in the current language
//   2. the platform's default language (Admin > Settings > Languages)
//   3. null — the caller falls back to its own hardcoded source value,
//      exactly like useTestAudio's staticFallbackPath argument.
export function useTestContent(testId) {
  const { language } = useLanguage();
  const [files, setFiles] = useState([]);
  const [defaultShortCode, setDefaultShortCode] = useState('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!testId) { setReady(true); return; }
    let cancelled = false;
    setReady(false);

    Promise.all([
      axios.get(`${API_URL}/public/elements?test_id=${testId}`),
      axios.get(`${API_URL}/public/translations/languages`),
    ]).then(([filesRes, langRes]) => {
      if (cancelled) return;
      setFiles((filesRes.data.elements || []).filter(e => e.asset_type?.startsWith('content_')));
      const defaultEntry = (langRes.data.languages || []).find(l => l.code === langRes.data.defaultLanguage);
      if (defaultEntry) setDefaultShortCode(defaultEntry.shortCode);
    }).catch(() => {
      // Network/server issue — resolution below just falls through to the caller's own fallback.
    }).finally(() => {
      if (!cancelled) setReady(true);
    });

    return () => { cancelled = true; };
  }, [testId]);

  const getContent = useCallback((elementKey) => {
    const assetType = `content_${elementKey}`;
    const findByLang = (lang) => files.find(f => f.asset_type === assetType && f.language === lang);

    const file = findByLang(language) || findByLang(defaultShortCode);
    return file?.config ?? null;
  }, [files, language, defaultShortCode]);

  return { getContent, ready };
}
