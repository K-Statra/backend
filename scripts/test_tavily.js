require('dotenv').config({ path: '.env.test' });
const axios = require('axios');

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

console.log('Testing Tavily API Key:', TAVILY_API_KEY ? 'Present' : 'Missing');

async function test() {
    try {
        const response = await axios.post('https://api.tavily.com/search', {
            api_key: TAVILY_API_KEY,
            query: 'Tesla',
            search_depth: 'basic',
            include_answer: true,
            max_results: 5,
        });
        console.log('Success!');
        console.log('Results count:', response.data.results.length);
        console.log('First result:', response.data.results[0]?.title);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

test();
