
require('dotenv').config();
const { pool } = require('./src/config/db');
const gameController = require('./src/controllers/gameController');

async function test() {
    const req = {};
    const res = {
        status: (code) => ({
            json: (data) => {
                console.log('Status:', code);
                console.log('Data:', JSON.stringify(data, null, 2));
            }
        })
    };
    await gameController.getReportOverview(req, res);
    process.exit(0);
}

test();
