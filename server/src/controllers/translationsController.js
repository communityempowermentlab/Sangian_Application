const translationsService = require('../services/translationsService');

// @desc    Get the translation grid (rows of key + per-language values), optionally filtered
// @route   GET /api/admin/translations?section=&search=
// @access  Private (admin)
const getGrid = (req, res) => {
    try {
        const { section, search } = req.query;
        const rows = translationsService.buildGrid({ section, search });
        const sections = translationsService.getSections();
        const sectionLabels = Object.fromEntries(
            sections.map((s) => [s, translationsService.getSectionLabel(s)]).filter(([, label]) => label)
        );
        const languages = translationsService.getLanguageSettings().languages;
        res.json({ rows, sections, sectionLabels, languages });
    } catch (error) {
        console.error('getGrid error:', error);
        res.status(500).json({ message: 'Failed to load translations.' });
    }
};

// @desc    Update a single translation cell (auto-save)
// @route   PUT /api/admin/translations/cell
// @body    { language, key, value }
// @access  Private (admin)
const updateCell = (req, res) => {
    try {
        const { language, key, value } = req.body;
        if (!language || !key) {
            return res.status(400).json({ message: 'language and key are required.' });
        }
        translationsService.updateCell(language, key, value ?? '');
        res.json({ success: true });
    } catch (error) {
        console.error('updateCell error:', error);
        res.status(500).json({ message: 'Failed to save translation.' });
    }
};

// @desc    Get language settings (enabled languages + default)
// @route   GET /api/admin/translations/languages
// @access  Private (admin)
const getLanguageSettings = (req, res) => {
    try {
        res.json(translationsService.getLanguageSettings());
    } catch (error) {
        console.error('getLanguageSettings error:', error);
        res.status(500).json({ message: 'Failed to load language settings.' });
    }
};

// @desc    Update language settings (enable/disable languages, set default)
// @route   PUT /api/admin/translations/languages
// @body    { defaultLanguage, languages: [{ code, label, enabled }] }
// @access  Private (admin)
const updateLanguageSettings = (req, res) => {
    try {
        const { defaultLanguage, languages } = req.body;
        if (!defaultLanguage || !Array.isArray(languages)) {
            return res.status(400).json({ message: 'defaultLanguage and languages are required.' });
        }
        const defaultEntry = languages.find((l) => l.code === defaultLanguage);
        if (!defaultEntry || !defaultEntry.enabled) {
            return res.status(400).json({ message: 'Default language must be one of the enabled languages.' });
        }
        translationsService.saveLanguageSettings({ defaultLanguage, languages });
        res.json({ success: true });
    } catch (error) {
        console.error('updateLanguageSettings error:', error);
        res.status(500).json({ message: 'Failed to save language settings.' });
    }
};

// @desc    Get the enabled languages list (for the public language selector)
// @route   GET /api/public/translations/languages
// @access  Public
const getPublicLanguageSettings = (req, res) => {
    try {
        const settings = translationsService.getLanguageSettings();
        res.json({
            defaultLanguage: settings.defaultLanguage,
            languages: settings.languages.filter((l) => l.enabled),
        });
    } catch (error) {
        console.error('getPublicLanguageSettings error:', error);
        res.status(500).json({ message: 'Failed to load languages.' });
    }
};

// @desc    Get the full translation tree for one language (consumed by the app at runtime)
// @route   GET /api/public/translations/:code
// @access  Public
const getPublicTranslations = (req, res) => {
    try {
        const { code } = req.params;
        const settings = translationsService.getLanguageSettings();
        const entry = settings.languages.find((l) => (l.code === code || l.shortCode === code) && l.enabled);
        if (!entry) {
            return res.status(404).json({ message: 'Language not found or not enabled.' });
        }
        res.json(translationsService.getTranslations(entry.code));
    } catch (error) {
        console.error('getPublicTranslations error:', error);
        res.status(500).json({ message: 'Failed to load translations.' });
    }
};

module.exports = {
    getGrid,
    updateCell,
    getLanguageSettings,
    updateLanguageSettings,
    getPublicLanguageSettings,
    getPublicTranslations,
};
