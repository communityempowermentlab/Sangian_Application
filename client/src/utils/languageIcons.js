export const languageIcons = {
    'en': 'A',
    'hi': 'अ',
    'as': 'অ',
    'bn': 'অ',
    'brx': 'ब',
    'doi': 'ड',
    'gu': 'અ',
    'kn': 'ಅ',
    'ks': 'ک',
    'kok': 'क',
    'mai': 'म',
    'ml': 'അ',
    'mni': 'ম',
    'mr': 'अ',
    'ne': 'न',
    'or': 'ଅ',
    'pa': 'ਅ',
    'sa': 'स',
    'sat': 'ᱥ',
    'sd': 'س',
    'ta': 'அ',
    'te': 'అ',
    'ur': 'ا'
};

export const getLanguageIcon = (code) => {
    // try exact match first
    if (languageIcons[code]) return languageIcons[code];
    // try matching the first part of the code (e.g., 'en-IN' -> 'en')
    const baseCode = code.split('-')[0];
    if (languageIcons[baseCode]) return languageIcons[baseCode];
    return '🌐'; // fallback
};
