
const axios = require('axios');

async function test() {
    try {
        // Test with rover_mela
        const res1 = await axios.get('http://localhost:5000/api/games/reports/detail/rover_mela');
        console.log('rover_mela columns:', res1.data.columns.slice(0, 5));

        // Test with chalo_mela_chale
        const res2 = await axios.get('http://localhost:5000/api/games/reports/detail/chalo_mela_chale');
        console.log('chalo_mela_chale columns:', res2.data.columns.slice(0, 5));

    } catch (err) {
        console.error('Test failed:', err.message);
    }
}

test();
