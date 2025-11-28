const axios = require('axios');

const baseURL = 'http://localhost:4000';

async function run() {
    try {
        console.log('1. Testing Dashboard Stats...');
        const dashboardRes = await axios.get(`${baseURL}/analytics/dashboard`);
        console.log('   Dashboard Stats:', dashboardRes.data);
        if (typeof dashboardRes.data.totalPartners !== 'number') throw new Error('Invalid dashboard data');

        console.log('2. Testing Top Industries...');
        const industriesRes = await axios.get(`${baseURL}/analytics/industries/top`);
        console.log(`   Top Industries count: ${industriesRes.data.length}`);
        if (!Array.isArray(industriesRes.data)) throw new Error('Invalid industries data');

        console.log('3. Testing Recent Transactions...');
        const transactionsRes = await axios.get(`${baseURL}/analytics/transactions/recent`);
        console.log(`   Recent Transactions count: ${transactionsRes.data.length}`);
        if (!Array.isArray(transactionsRes.data)) throw new Error('Invalid transactions data');

        console.log('SUCCESS: Overview API verified.');
    } catch (err) {
        console.error('FAILED:', err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
        process.exit(1);
    }
}

run();
