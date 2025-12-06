const axios = require('axios');

const API_BASE = 'http://localhost:4000';

async function testSearch() {
    const q = "I'm American K-beauty producs importer. Recommend me Korea K-beauty producs exporter";
    const params = {
        q: q,
        limit: 50,
        industry: 'Beauty / Consumer Goods / Food',
        country: 'South Korea',
        partnership: 'Supplier'
    };

    console.log(`Testing Search API: ${API_BASE}/partners/search`);
    console.log('Params:', params);

    try {
        const response = await axios.get(`${API_BASE}/partners/search`, { params });
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));

        if (response.data.data && response.data.data.length > 0) {
            console.log('SUCCESS: Found results!');
        } else {
            console.log('FAILURE: No results found.');
        }
    } catch (err) {
        console.error('Request Failed:', err.message);
        if (err.response) {
            console.error('Response Status:', err.response.status);
            console.error('Response Data:', JSON.stringify(err.response.data, null, 2));
        }
    }
}

testSearch();
