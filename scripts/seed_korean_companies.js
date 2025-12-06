const { connectDB } = require('../src/config/db');
const { Company } = require('../src/models/Company');
require('dotenv').config();

const companies = [
    {
        name: 'Samsung Electronics',
        industry: 'Electronics',
        offerings: ['Semiconductors', 'Smartphones', 'Consumer Electronics', 'Display Panels'],
        location: { country: 'South Korea', city: 'Suwon' },
        tags: ['Semiconductors', 'Mobile', 'AI', '5G', 'IoT'],
        profileText: 'Samsung Electronics is a global leader in technology, opening new possibilities for people everywhere. We are a top manufacturer of semiconductors, smartphones, and home appliances.',
        website: 'https://www.samsung.com'
    },
    {
        name: 'SK Hynix',
        industry: 'Semiconductors',
        offerings: ['DRAM', 'NAND Flash', 'CMOS Image Sensors'],
        location: { country: 'South Korea', city: 'Icheon' },
        tags: ['Memory', 'Semiconductors', 'AI Hardware', 'Data Center'],
        profileText: 'SK Hynix is a top-tier semiconductor supplier offering Dynamic Random Access Memory chips (DRAM), Flash memory chips (NAND Flash), and CMOS Image Sensors (CIS).',
        website: 'https://www.skhynix.com'
    },
    {
        name: 'LG Energy Solution',
        industry: 'Energy',
        offerings: ['EV Batteries', 'ESS', 'Mobility & IT Batteries'],
        location: { country: 'South Korea', city: 'Seoul' },
        tags: ['Batteries', 'EV', 'Green Energy', 'Energy Storage'],
        profileText: 'LG Energy Solution is a global leader in delivering advanced lithium-ion batteries for Electric Vehicles (EV), Mobility & IT applications, and Energy Storage Systems (ESS).',
        website: 'https://www.lgensol.com'
    },
    {
        name: 'Samsung Biologics',
        industry: 'Biotechnology',
        offerings: ['CDMO Services', 'Biopharmaceuticals', 'Antibody Drugs'],
        location: { country: 'South Korea', city: 'Incheon' },
        tags: ['Bio', 'Pharma', 'CDMO', 'Healthcare'],
        profileText: 'Samsung Biologics is a fully integrated CDMO offering state-of-the-art contract development and manufacturing services to the global biopharmaceutical industry.',
        website: 'https://www.samsungbiologics.com'
    },
    {
        name: 'Hyundai Motor Company',
        industry: 'Automotive',
        offerings: ['Passenger Vehicles', 'Commercial Vehicles', 'Electric Vehicles', 'Hydrogen Cars'],
        location: { country: 'South Korea', city: 'Seoul' },
        tags: ['Automotive', 'EV', 'Mobility', 'Hydrogen'],
        profileText: 'Hyundai Motor Company is a global automotive manufacturer committed to becoming a Smart Mobility Solution Provider, investing in robotics and Urban Air Mobility (UAM).',
        website: 'https://www.hyundai.com'
    },
    {
        name: 'Kia Corporation',
        industry: 'Automotive',
        offerings: ['Passenger Cars', 'SUVs', 'EVs', 'PBVs'],
        location: { country: 'South Korea', city: 'Seoul' },
        tags: ['Automotive', 'EV', 'Design', 'Mobility'],
        profileText: 'Kia is a global mobility brand with a vision to create sustainable mobility solutions for consumers, communities, and societies around the world.',
        website: 'https://www.kia.com'
    },
    {
        name: 'POSCO Holdings',
        industry: 'Steel',
        offerings: ['Steel Products', 'Secondary Battery Materials', 'Hydrogen'],
        location: { country: 'South Korea', city: 'Pohang' },
        tags: ['Steel', 'Materials', 'Green Energy', 'Lithium'],
        profileText: 'POSCO is a world-leading steelmaker that is diversifying into green materials, including lithium and nickel for secondary batteries and hydrogen business.',
        website: 'https://www.posco.co.kr'
    },
    {
        name: 'Naver',
        industry: 'IT',
        offerings: ['Search Engine', 'Cloud Platform', 'AI Services', 'Webtoon'],
        location: { country: 'South Korea', city: 'Seongnam' },
        tags: ['Internet', 'AI', 'Cloud', 'Content', 'Tech'],
        profileText: 'Naver is South Korea’s largest web search engine and a global ICT brand, offering services ranging from search and commerce to fintech, cloud, and content.',
        website: 'https://www.navercorp.com'
    },
    {
        name: 'LG Chem',
        industry: 'Chemicals',
        offerings: ['Petrochemicals', 'Advanced Materials', 'Life Sciences'],
        location: { country: 'South Korea', city: 'Seoul' },
        tags: ['Chemicals', 'Materials', 'Bio', 'Sustainability'],
        profileText: 'LG Chem is a leading global chemical company with a diversified business portfolio that includes petrochemicals, advanced materials, and life sciences.',
        website: 'https://www.lgchem.com'
    },
    {
        name: 'Samsung SDI',
        industry: 'Energy',
        offerings: ['Small Li-ion Batteries', 'Automotive Batteries', 'ESS', 'Electronic Materials'],
        location: { country: 'South Korea', city: 'Yongin' },
        tags: ['Batteries', 'Electronics', 'Materials', 'Energy'],
        profileText: 'Samsung SDI is a battery and electronic materials manufacturer, creating energy solutions for IT devices, electric vehicles, and energy storage systems.',
        website: 'https://www.samsungsdi.com'
    },
    {
        name: 'Kakao',
        industry: 'IT',
        offerings: ['Mobile Messenger', 'Fintech', 'Mobility', 'Entertainment'],
        location: { country: 'South Korea', city: 'Jeju' },
        tags: ['Mobile', 'Platform', 'Social', 'Tech'],
        profileText: 'Kakao is a mobile lifestyle platform company offering a wide range of services including communication, content, mobility, and fintech via KakaoTalk.',
        website: 'https://www.kakaocorp.com'
    },
    {
        name: 'Celltrion',
        industry: 'Biotechnology',
        offerings: ['Biosimilars', 'Innovative Drugs'],
        location: { country: 'South Korea', city: 'Incheon' },
        tags: ['Bio', 'Pharma', 'Biosimilars', 'Healthcare'],
        profileText: 'Celltrion is a biopharmaceutical company specializing in the research, development, and manufacture of biosimilars and innovative drugs.',
        website: 'https://www.celltrion.com'
    },
    {
        name: 'Hyundai Mobis',
        industry: 'Automotive Parts',
        offerings: ['Chassis Modules', 'Cockpit Modules', 'Safety Systems', 'Electrification Parts'],
        location: { country: 'South Korea', city: 'Seoul' },
        tags: ['Auto Parts', 'Autonomous Driving', 'EV Components'],
        profileText: 'Hyundai Mobis is a global auto parts supplier, focusing on autonomous driving, connectivity, and electrification technologies.',
        website: 'https://www.mobis.co.kr'
    },
    {
        name: 'KB Financial Group',
        industry: 'Finance',
        offerings: ['Banking', 'Insurance', 'Securities', 'Asset Management'],
        location: { country: 'South Korea', city: 'Seoul' },
        tags: ['Finance', 'Banking', 'Fintech', 'Investment'],
        profileText: 'KB Financial Group is a leading financial services provider in Korea, offering a broad range of financial products and services.',
        website: 'https://www.kbfg.com'
    },
    {
        name: 'Shinhan Financial Group',
        industry: 'Finance',
        offerings: ['Banking', 'Credit Cards', 'Investment', 'Life Insurance'],
        location: { country: 'South Korea', city: 'Seoul' },
        tags: ['Finance', 'Banking', 'Global Finance', 'Digital Banking'],
        profileText: 'Shinhan Financial Group is a major financial holding company in Korea, providing comprehensive financial solutions to customers worldwide.',
        website: 'https://www.shinhangroup.com'
    },
    {
        name: 'SK Innovation',
        industry: 'Energy',
        offerings: ['Petroleum', 'Lubricants', 'Chemicals', 'Batteries'],
        location: { country: 'South Korea', city: 'Seoul' },
        tags: ['Energy', 'Oil', 'Green Energy', 'Recycling'],
        profileText: 'SK Innovation is an intermediate holding company in the energy and chemical sector, driving green innovation and sustainable growth.',
        website: 'https://www.skinnovation.com'
    },
    {
        name: 'LG Electronics',
        industry: 'Electronics',
        offerings: ['Home Appliances', 'TVs', 'Air Solutions', 'Vehicle Components'],
        location: { country: 'South Korea', city: 'Seoul' },
        tags: ['Appliances', 'Smart Home', 'AI', 'Electronics'],
        profileText: 'LG Electronics is a global innovator in technology and consumer electronics, known for its premium home appliances and OLED TVs.',
        website: 'https://www.lg.com'
    },
    {
        name: 'Samsung C&T',
        industry: 'Construction',
        offerings: ['Construction', 'Trading', 'Fashion', 'Resort'],
        location: { country: 'South Korea', city: 'Seoul' },
        tags: ['Construction', 'Trade', 'Engineering', 'Lifestyle'],
        profileText: 'Samsung C&T is a diverse business group involved in engineering & construction, trading & investment, fashion, and resort businesses.',
        website: 'https://www.samsungcnt.com'
    },
    {
        name: 'Hana Financial Group',
        industry: 'Finance',
        offerings: ['Banking', 'Securities', 'Credit Cards', 'Capital'],
        location: { country: 'South Korea', city: 'Seoul' },
        tags: ['Finance', 'Banking', 'Global Network', 'Forex'],
        profileText: 'Hana Financial Group is a prominent financial group in Korea with a strong global network, dedicated to growing together with customers.',
        website: 'https://www.hanafn.com'
    },
    {
        name: 'Krafton',
        industry: 'Gaming',
        offerings: ['PUBG', 'Mobile Games', 'Console Games'],
        location: { country: 'South Korea', city: 'Seoul' },
        tags: ['Gaming', 'Content', 'Esports', 'Technology'],
        profileText: 'Krafton is a collective of independent game development studios, best known for creating PUBG: BATTLEGROUNDS and expanding into multimedia entertainment.',
        website: 'https://www.krafton.com'
    }
];

async function seed() {
    try {
        await connectDB();
        console.log(`[Seed] Connected to DB. Seeding ${companies.length} companies...`);

        for (const companyData of companies) {
            await Company.findOneAndUpdate(
                { name: companyData.name },
                {
                    ...companyData,
                    dataSource: 'seed_korean_top20',
                    extractedAt: new Date()
                },
                { upsert: true, new: true }
            );
            console.log(`[Seed] Upserted: ${companyData.name}`);
        }

        console.log('[Seed] Completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('[Seed] Error:', err);
        process.exit(1);
    }
}

seed();
