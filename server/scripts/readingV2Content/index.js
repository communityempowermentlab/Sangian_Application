// Padh ke Batao V2 — combined AI-drafted content for all seeded languages.
// hi is the authoritative source (byte-identical to today's hardcoded
// ReadingSkillGameV2.jsx constants); every other language is an AI-drafted
// translation for Admin review via the new Test Content panel.
//
// Deliberately NOT included: brx (Bodo), mni (Manipuri), sat (Santali).
// Confidence in producing genuinely correct native-language content for
// these three was too low to respectfully seed — doing so would mean
// showing fabricated or placeholder text under a real language's name,
// which is exactly the "silently display the wrong language" failure this
// whole feature exists to prevent. They're left unconfigured so the Admin
// grid correctly shows "Missing" and prompts real native-speaker input.

module.exports = {
  ...require('./group1'), // hi, en, mr, ne, sa
  ...require('./group2'), // bn, as, gu, pa, or
  ...require('./group3'), // te, kn, ml, ta
  ...require('./group4'), // ur, sd, ks, mai, doi, kok
};
