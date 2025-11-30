const axios = require('axios')

const TAVILY_API_KEY = process.env.TAVILY_API_KEY

async function searchWeb(query) {
    if (!TAVILY_API_KEY) {
        console.warn('TAVILY_API_KEY is not set. Web search will fail.')
        return []
    }

    try {
        const response = await axios.post('https://api.tavily.com/search', {
            api_key: TAVILY_API_KEY,
            query: query,
            search_depth: 'basic', // or 'advanced'
            include_answer: true,
            include_images: false,
            max_results: 5,
        })

        return response.data
    } catch (error) {
        console.error('Tavily Search Error:', error.response?.data || error.message)
        return { results: [], answer: '' }
    }
}

module.exports = { searchWeb }
