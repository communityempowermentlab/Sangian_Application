const { pool } = require('../src/config/db');

async function clearAllTestData() {
    console.log('--- Database Cleanup Started ---');
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Delete Game PDFs
        console.log('Clearing game_dashboard_pdfs...');
        await conn.execute('DELETE FROM game_dashboard_pdfs');

        // 2. Delete Game Assessments (Note: ON DELETE CASCADE from sessions might handle this, but explicit is safer)
        console.log('Clearing game_assessments...');
        await conn.execute('DELETE FROM game_assessments');

        // 3. Delete Game Sessions
        console.log('Clearing game_sessions...');
        await conn.execute('DELETE FROM game_sessions');

        // 4. Delete Login Sessions (Child)
        console.log('Clearing login_sessions...');
        await conn.execute('DELETE FROM login_sessions');

        // 5. Delete Admin Login Sessions
        console.log('Clearing admin_login_sessions...');
        await conn.execute('DELETE FROM admin_login_sessions');

        // 6. Delete Children (Profiles)
        console.log('Clearing children...');
        await conn.execute('DELETE FROM children');

        // 7. Reset Auto-increments (Optional but makes it a true fresh start)
        console.log('Resetting auto-increments...');
        await conn.execute('ALTER TABLE game_dashboard_pdfs AUTO_INCREMENT = 1');
        await conn.execute('ALTER TABLE game_assessments AUTO_INCREMENT = 1');
        await conn.execute('ALTER TABLE game_sessions AUTO_INCREMENT = 1');
        await conn.execute('ALTER TABLE login_sessions AUTO_INCREMENT = 1');
        await conn.execute('ALTER TABLE admin_login_sessions AUTO_INCREMENT = 1');
        await conn.execute('ALTER TABLE children AUTO_INCREMENT = 1');

        await conn.commit();
        console.log('--- Database Cleanup Completed Successfully ---');
    } catch (error) {
        await conn.rollback();
        console.error('!!! Cleanup Failed - Transaction Rolled Back !!!');
        console.error(error);
    } finally {
        conn.release();
        process.exit(0);
    }
}

clearAllTestData();
