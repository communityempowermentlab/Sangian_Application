const db = require('./src/config/db');

async function seed() {
    try {
        const pool = db.promise();
        const langs = ['en', 'hi', 'mr', 'te', 'kn'];
        for (const lang of langs) {
            await pool.query(
                `INSERT INTO game_elements (test_id, language, asset_type, file_path, metadata) 
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE file_path=VALUES(file_path)`,
                ['numeracy_number_skill_v2', lang, 'splash_screen', '/assets/images/number_skill_v2/number_skill.jpg', JSON.stringify({})]
            );
            console.log('Seeded', lang);
        }
        console.log('Done!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
seed();
