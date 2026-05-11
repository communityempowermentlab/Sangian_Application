const axios = require('axios');
axios.get('http://localhost:3000/api/games/reports/detail/rover_mela', { headers: { Authorization: "Bearer test" } })
  .then(res => {
    console.log("SUCCESS:", Object.keys(res.data));
  })
  .catch(err => {
    console.error("ERROR:", err.response ? err.response.data : err.message);
  });
