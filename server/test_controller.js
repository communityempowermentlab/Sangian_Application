require('dotenv').config();
const { pool } = require('./src/config/db');
const { getReportDetail } = require('./src/controllers/gameController');

async function run() {
  const req = { params: { gameName: 'triangle_rachna' } };
  const res = {
    status: (code) => ({
      json: (data) => {
        console.log(JSON.stringify(data.data[0].question_scores, null, 2));
        process.exit(0);
      }
    })
  };
  await getReportDetail(req, res);
}
run();
