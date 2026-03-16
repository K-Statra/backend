const axios = require('axios')

const TAVILY_API_KEY = process.env.TAVILY_API_KEY

async function searchWeb(query) {
    if (!TAVILY_API_KEY) {
        console.warn('[Tavily] TAVILY_API_KEY is not set. Web search disabled.')
        return { results: [], answer: '' }
    }

    console.log(`[Tavily] Searching for: "${query.substring(0, 80)}..." key prefix: ${TAVILY_API_KEY.substring(0, 12)}`)

    try {
        const response = await axios.post('https://api.tavily.com/search', {
            api_key: TAVILY_API_KEY,
            query: query,
            search_depth: 'basic',
            include_answer: true,
            include_images: false,
            max_results: 5,
        }, { timeout: 15000 })

        const results = response.data?.results || []
        console.log(`[Tavily] Success — ${results.length} results returned.`)
        return response.data
    } catch (error) {
        const status = error.response?.status
        const errData = error.response?.data
        console.error(`[Tavily] Search FAILED. Status: ${status}, Error:`, errData || error.message)
        return { results: [], answer: '' }
    }
}

module.exports = { searchWeb }
