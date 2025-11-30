require('dotenv').config()
const mongoose = require('mongoose')
const { connectDB } = require('../src/config/db')
const { Company } = require('../src/models/Company')
const { embed } = require('../src/providers/embeddings')

const realCompanies = [
    {
        name: 'Sephora',
        industry: 'Beauty / Consumer Goods / Food',
        location: { city: 'San Francisco', state: 'CA', country: 'United States' },
        profileText: 'Leading multinational beauty retailer featuring thousands of brands, including a strong portfolio of K-Beauty products. Actively seeking innovative Korean skincare and cosmetic brands for US distribution.',
        website: 'https://www.sephora.com',
        tags: ['Retail', 'Beauty', 'Global Distributor', 'K-Beauty'],
        sizeBucket: '1000+',
        matchRecommendation: 'Top-tier retail partner for established K-Beauty brands looking for massive exposure.',
        matchAnalysis: [
            { label: 'Market Reach', score: 98, description: 'Dominant presence in US beauty retail.' },
            { label: 'K-Beauty Fit', score: 95, description: 'Dedicated K-Beauty sections and high consumer demand.' }
        ]
    },
    {
        name: 'Ulta Beauty',
        industry: 'Beauty / Consumer Goods / Food',
        location: { city: 'Bolingbrook', state: 'IL', country: 'United States' },
        profileText: 'The largest beauty retailer in the US, offering cosmetics, fragrance, skin care products, hair care products, and salon services. Expanding selection of Korean beauty brands.',
        website: 'https://www.ulta.com',
        tags: ['Retail', 'Cosmetics', 'Mass Market', 'Prestige'],
        sizeBucket: '1000+',
        matchRecommendation: 'Excellent partner for brands targeting both mass market and prestige segments.',
        matchAnalysis: [
            { label: 'Distribution Network', score: 96, description: 'Extensive store network across the US.' },
            { label: 'Brand Diversity', score: 92, description: 'Carries a wide range of price points and categories.' }
        ]
    },
    {
        name: 'Soko Glam',
        industry: 'Beauty / Consumer Goods / Food',
        location: { city: 'New York', state: 'NY', country: 'United States' },
        profileText: 'Premier online marketplace specializing in Korean beauty products. Curates the best selection of K-Beauty skincare and makeup. Founded by Charlotte Cho.',
        website: 'https://sokoglam.com',
        tags: ['E-commerce', 'K-Beauty Specialist', 'Curator', 'Online Retail'],
        sizeBucket: '51-200',
        matchRecommendation: 'The most authentic partner for niche and high-quality K-Beauty brands.',
        matchAnalysis: [
            { label: 'Niche Expertise', score: 99, description: 'Deep understanding of K-Beauty philosophy and trends.' },
            { label: 'Community Engagement', score: 94, description: 'Strong community of K-Beauty enthusiasts.' }
        ]
    },
    {
        name: 'Peach & Lily',
        industry: 'Beauty / Consumer Goods / Food',
        location: { city: 'New York', state: 'NY', country: 'United States' },
        profileText: 'K-Beauty retailer and distributor known for bringing cult-favorite Korean skincare brands to the US market. Also has its own private label.',
        website: 'https://www.peachandlily.com',
        tags: ['Distributor', 'Retailer', 'Skincare', 'K-Beauty'],
        sizeBucket: '11-50',
        matchRecommendation: 'Ideal for high-efficacy skincare brands seeking premium positioning.',
        matchAnalysis: [
            { label: 'Quality Curation', score: 95, description: 'Known for rigorous vetting of ingredients and efficacy.' },
            { label: 'Trendsetting', score: 90, description: 'Often introduces new K-Beauty trends to the West.' }
        ]
    },
    {
        name: 'YesStyle',
        industry: 'Beauty / Consumer Goods / Food',
        location: { city: 'Hong Kong', country: 'China' }, // Global, but HQ in HK
        profileText: 'Global e-commerce platform for Asian beauty and fashion. Huge catalog of Korean cosmetic brands shipping worldwide, including to the US.',
        website: 'https://www.yesstyle.com',
        tags: ['E-commerce', 'Global Shipping', 'Asian Beauty', 'Fashion'],
        sizeBucket: '201-1000',
        matchRecommendation: 'Great for brands wanting immediate global reach with minimal logistics setup.',
        matchAnalysis: [
            { label: 'Global Logistics', score: 93, description: 'Robust international shipping infrastructure.' },
            { label: 'Volume', score: 91, description: 'High traffic volume and customer base.' }
        ]
    },
    {
        name: 'iHerb',
        industry: 'Beauty / Consumer Goods / Food',
        location: { city: 'Irvine', state: 'CA', country: 'United States' },
        profileText: 'Global leader in health and wellness e-commerce. carries a significant selection of K-Beauty products, focusing on natural and clean beauty.',
        website: 'https://www.iherb.com',
        tags: ['E-commerce', 'Wellness', 'Clean Beauty', 'Global'],
        sizeBucket: '1000+',
        matchRecommendation: 'Perfect for clean, natural, or wellness-focused K-Beauty brands.',
        matchAnalysis: [
            { label: 'Wellness Focus', score: 94, description: 'Aligns well with clean and healthy beauty trends.' },
            { label: 'Logistics', score: 97, description: 'World-class automated fulfillment centers.' }
        ]
    },
    {
        name: 'Costco Wholesale',
        industry: 'Beauty / Consumer Goods / Food',
        location: { city: 'Issaquah', state: 'WA', country: 'United States' },
        profileText: 'Membership-only warehouse club. Occasionally carries K-Beauty sets and popular items in bulk. High volume, low SKU count.',
        website: 'https://www.costco.com',
        tags: ['Wholesale', 'Bulk', 'Retail', 'Big Box'],
        sizeBucket: '1000+',
        matchRecommendation: 'The holy grail for high-volume, mass-market items. Requires large production capacity.',
        matchAnalysis: [
            { label: 'Volume Potential', score: 99, description: 'Unmatched sales volume per SKU.' },
            { label: 'Brand Exposure', score: 88, description: 'Exposure to millions of members.' }
        ]
    },
    {
        name: 'Target',
        industry: 'Beauty / Consumer Goods / Food',
        location: { city: 'Minneapolis', state: 'MN', country: 'United States' },
        profileText: 'Major US retailer with a growing dedicated beauty section. actively expanding its assortment of affordable and trendy K-Beauty brands.',
        website: 'https://www.target.com',
        tags: ['Retail', 'Mass Market', 'Trendy', 'Accessible'],
        sizeBucket: '1000+',
        matchRecommendation: 'Best for accessible, trendy, and affordable K-Beauty brands.',
        matchAnalysis: [
            { label: 'Mass Appeal', score: 93, description: 'Reaches a broad demographic of beauty shoppers.' },
            { label: 'Trend Aware', score: 90, description: 'Quick to adopt viral beauty trends.' }
        ]
    },
    {
        name: 'Credo Beauty',
        industry: 'Beauty / Consumer Goods / Food',
        location: { city: 'San Francisco', state: 'CA', country: 'United States' },
        profileText: 'The largest clean beauty retailer in the US. Strict standards for ingredients. Open to clean, sustainable K-Beauty brands.',
        website: 'https://credobeauty.com',
        tags: ['Clean Beauty', 'Retail', 'Sustainable', 'Premium'],
        sizeBucket: '51-200',
        matchRecommendation: 'Strictly for certified clean and sustainable K-Beauty brands.',
        matchAnalysis: [
            { label: 'Clean Standards', score: 98, description: 'Leader in the clean beauty movement.' },
            { label: 'Premium Niche', score: 92, description: 'Attracts conscious consumers willing to pay more.' }
        ]
    },
    {
        name: 'Urban Outfitters',
        industry: 'Beauty / Consumer Goods / Food',
        location: { city: 'Philadelphia', state: 'PA', country: 'United States' },
        profileText: 'Lifestyle retailer targeting Gen Z and Millennials. Curates a fun, trendy selection of beauty products, including unique K-Beauty finds.',
        website: 'https://www.urbanoutfitters.com',
        tags: ['Lifestyle', 'Gen Z', 'Trendy', 'Fashion'],
        sizeBucket: '1000+',
        matchRecommendation: 'Great for fun, colorful, and "Instagrammable" K-Beauty products.',
        matchAnalysis: [
            { label: 'Youth Demographic', score: 96, description: 'Direct line to Gen Z consumers.' },
            { label: 'Trend Curation', score: 94, description: 'Focus on aesthetics and viral potential.' }
        ]
    },
    {
        name: 'Bemused Korea',
        industry: 'Beauty / Consumer Goods / Food',
        location: { city: 'Los Angeles', state: 'CA', country: 'United States' }, // Assuming LA based or strong presence
        profileText: 'US-based distributor and retailer of premium Korean skincare. Focuses on hidden gems and high-quality formulations.',
        website: 'https://bemusedkorea.com',
        tags: ['Distributor', 'Premium', 'Skincare', 'Niche'],
        sizeBucket: '1-10',
        matchRecommendation: 'Good partner for high-end, niche skincare brands looking for dedicated representation.',
        matchAnalysis: [
            { label: 'Quality Focus', score: 90, description: 'Prioritizes formulation quality over hype.' },
            { label: 'Niche Market', score: 85, description: 'Serves a knowledgeable skincare community.' }
        ]
    },
    {
        name: 'Ohlolly',
        industry: 'Beauty / Consumer Goods / Food',
        location: { city: 'Los Angeles', state: 'CA', country: 'United States' },
        profileText: 'Online K-Beauty curator based in Los Angeles. Brings the latest and greatest Korean beauty trends to the US market.',
        website: 'https://ohlolly.com',
        tags: ['E-commerce', 'Curator', 'LA-based', 'K-Beauty'],
        sizeBucket: '1-10',
        matchRecommendation: 'Perfect local partner in LA for brands wanting a curated online presence.',
        matchAnalysis: [
            { label: 'Local Presence', score: 92, description: 'Based in LA, the heart of US K-Beauty.' },
            { label: 'Curation', score: 89, description: 'Carefully selected portfolio of brands.' }
        ]
    },
    {
        name: 'Palace Beauty',
        industry: 'Beauty / Consumer Goods / Food',
        location: { city: 'Los Angeles', state: 'CA', country: 'United States' },
        profileText: 'Established K-Beauty retailer in Koreatown, Los Angeles. Physical store and online presence serving the local community and beyond.',
        website: 'https://www.palacebeauty.com',
        tags: ['Retail', 'Local', 'Koreatown', 'Physical Store'],
        sizeBucket: '11-50',
        matchRecommendation: 'Solid partner for entering the core Korean-American market in LA.',
        matchAnalysis: [
            { label: 'Community Roots', score: 95, description: 'Deep ties to the LA Koreatown community.' },
            { label: 'Physical Retail', score: 88, description: 'Brick-and-mortar presence in a key location.' }
        ]
    },
    {
        name: 'Beauty Tap',
        industry: 'Beauty / Consumer Goods / Food',
        location: { city: 'Los Angeles', state: 'CA', country: 'United States' },
        profileText: 'Premier destination for Asian beauty education and products. Combines editorial content with e-commerce.',
        website: 'https://beautytap.com',
        tags: ['Media', 'Education', 'E-commerce', 'K-Beauty'],
        sizeBucket: '11-50',
        matchRecommendation: 'Ideal for brands that need storytelling and education to sell their products.',
        matchAnalysis: [
            { label: 'Content Marketing', score: 94, description: 'Strong editorial and educational content.' },
            { label: 'Expert Review', score: 90, description: 'Products vetted by beauty professionals.' }
        ]
    }
]

async function seedRealData() {
    try {
        console.log('[seed-real] connecting DB...')
        await connectDB()

        console.log('[seed-real] clearing old demo data...')
        await Company.deleteMany({ dataSource: 'demo_seed_real' })

        console.log('[seed-real] preparing documents with embeddings...')
        const docs = []

        for (const company of realCompanies) {
            // Generate embedding for vector search
            const textToEmbed = `${company.name} ${company.industry} ${company.profileText} ${company.tags.join(' ')} ${company.location.city} ${company.location.country}`
            const embedding = await embed(textToEmbed)

            docs.push({
                ...company,
                embedding, // Important for vector search!
                dataSource: 'demo_seed_real',
                extractedAt: new Date(),
                primaryContact: {
                    name: 'Partner Manager',
                    email: 'partners@' + new URL(company.website).hostname.replace('www.', '')
                }
            })
            console.log(`[seed-real] prepared: ${company.name}`)
        }

        console.log('[seed-real] inserting documents...')
        const result = await Company.insertMany(docs)
        console.log(`[seed-real] successfully inserted ${result.length} real companies!`)

    } catch (err) {
        console.error('[seed-real] error:', err)
    } finally {
        await mongoose.disconnect()
        console.log('[seed-real] done.')
        process.exit(0)
    }
}

seedRealData()
