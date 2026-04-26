
require('dotenv').config();
const { pool } = require('./src/config/db');
const gameController = require('./src/controllers/gameController');

async function test() {
    const req = { params: { gameName: 'cognitive_flex_chor' } };
    const res = {
        status: (code) => ({
            json: (data) => {
                console.log('Status:', code);
                console.log('Data Length:', data.data ? data.data.length : 0);
                if (data.data && data.data.length > 0) {
                   console.log('First Item:', JSON.stringify(data.data[0], null, 2));
                }
            }
        })
    };
    await gameController.getReportDetail(req, res);
    process.exit(0);
}

test();
