// Maps every historical/alternate spelling of a game_name to its canonical
// catalog key (the GAMES_REGISTRY key in testConfigService.js). Extracted
// from gameController.js (where it originated, and is still used exactly as
// before) so the new organization test-assignment feature can reuse the
// same mapping without duplicating it or creating a circular require.
const normalizeGameName = (name) => {
    if (['Chalo Mela Chale', 'chalo_mela_chale', 'rover_mela', 'Rover Test', 'Rover Game'].includes(name)) return 'rover_mela';
    if (['chor_machaye_shor', 'cognitive_flex_chor'].includes(name)) return 'cognitive_flex_chor';
    if (['literacy_reading_skill', 'reading_skill', 'Padh ke batao'].includes(name)) return 'literacy_reading_skill';
    if (['literacy_reading_skill_v2', 'Padh ke batao - Version 2'].includes(name)) return 'literacy_reading_skill_v2';
    if (['numeracy_number_skill', 'Ankganit'].includes(name)) return 'numeracy_number_skill';
    if (['working_memory_herpher', 'Her Pher'].includes(name)) return 'working_memory_herpher';
    if (['working_memory_herpher_v2', 'Her Pher - Version 2'].includes(name)) return 'working_memory_herpher_v2';
    if (['working_memory_herpher_v3', 'Her Pher - Version 3'].includes(name)) return 'working_memory_herpher_v3';
    if (['atlantis_bagiya', 'Bagiya', 'Atlantis Test', 'Atlantis Game'].includes(name)) return 'atlantis_bagiya';
    return name;
};

module.exports = { normalizeGameName };
