require('dotenv').config();
const mongoose = require('mongoose');
const { Company } = require('../src/models/Company');

// Normalization Rules
const KEYWORD_MAP = [
    // Beauty & Cosmetics
    { keywords: ['beauty', 'skincare', 'cosmetic', 'makeup', 'make-up', 'fragrance', 'perfume', 'hair', 'nail', 'salon', 'bodycare', 'soap', 'hygiene', 'grooming', 'toiletries', '화장품', '뷰티', '미용', '에스테틱'], category: 'Beauty & Cosmetics' },

    // Food & Beverage
    { keywords: ['food', 'beverage', 'snack', 'candy', 'biscuit', 'cake', 'coffee', 'tea', 'drink', 'bakery', 'nutrition', 'ingredient', 'dietary', 'supplement', 'fishery', 'agriculture', '식품', '음료', '푸드', '간식', '농수산', '수산'], category: 'Food & Beverage' },

    // Tech & Electronics
    { keywords: ['tech', 'ai', 'artificial intelligence', 'software', 'computer', 'server', 'mobile', 'app', 'platform', 'cyber', 'security', 'data', 'cloud', 'iot', 'robot', 'electronic', 'display', 'semiconductor', 'battery', 'it', 'pc', 'computing', 'telecom', 'network', '소프트웨어', '정보통신', '전자', '반도체', '플랫폼', '통신'], category: 'Tech & Electronics' },

    // Health & Bio
    { keywords: ['health', 'medical', 'pharma', 'bio', 'wellness', 'spa', 'clinic', 'medicine', 'dental', 'doctor', 'hospital', 'rehab', 'biotech', 'life science', '바이오', '의료', '헬스', '제약', '건강'], category: 'Health & Bio' },

    // Pet Care
    { keywords: ['pet', 'dog', 'cat', 'animal', 'veterinary', 'zoo', 'feed', '펫', '반려동물', '사료'], category: 'Pet Care' },

    // Industrial & Manufacturing
    { keywords: ['manufacturing', 'machinery', 'equipment', 'industrial', 'tool', 'metal', 'plastic', 'chemical', 'engineering', 'oem', 'odm', 'material', 'component', 'connector', 'socket', 'steel', 'construction', 'auto', 'vehicle', 'mobility', '제조', '기계', '부품', '소재', '화학', '장비', '철강', '건설', '자동차'], category: 'Industrial & Manufacturing' },

    // Energy & Environment
    { keywords: ['energy', 'solar', 'wind', 'power', 'climate', 'eco', 'environment', 'esg', 'recycling', 'waste', 'water', 'air', 'pollution', '에너지', '환경', '탄소', '친환경'], category: 'Energy & Environment' },

    // Lifestyle & Home
    { keywords: ['home', 'living', 'furniture', 'kitchen', 'bath', 'interior', 'design', 'deco', 'lighting', 'lamp', 'household', 'bedding', 'textile', '가구', '리빙', '인테리어', '주방', '조명', '생활'], category: 'Lifestyle & Home' },

    // Fashion & Accessories
    { keywords: ['fashion', 'apparel', 'clothing', 'wear', 'textile', 'fabric', 'accessory', 'accessories', 'jewelry', 'jewellery', 'bag', 'shoe', 'shoe', 'watch', 'eyewear', 'glasses', '패션', '의류', '가방', '주얼리', '신발', '안경', '잡화'], category: 'Fashion & Accessories' },

    // Sports & Leisure
    { keywords: ['sport', 'gym', 'fitness', 'outdoor', 'camping', 'leisure', 'game', 'gaming', 'toy', 'hobby', 'golf', 'travel', 'tour', '스포츠', '레저', '운동', '게임', '캠핑', '골프', '여행'], category: 'Sports & Leisure' },

    // Services
    { keywords: ['service', 'consulting', 'marketing', 'logistics', 'shipping', 'distribution', 'finance', 'invest', 'education', 'training', 'ad', 'advertising', 'agency', '서비스', '컨설팅', '물류', '유통', '교육', '광고', '금융', '투자'], category: 'Services' }
];

const normalize = (rawIndustry) => {
    if (!rawIndustry) return '(Unspecified)';

    const lower = rawIndustry.toLowerCase();

    for (const rule of KEYWORD_MAP) {
        if (rule.keywords.some(k => lower.includes(k))) {
            return rule.category;
        }
    }

    return 'Other'; // If no match found
};

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('--- Industry Normalization Started ---');

        // Process all companies that have an industry (even if already 'Other', we might retry with better keywords)
        // Or just process everything to be safe.
        const companies = await Company.find({ industry: { $exists: true } }).select('industry tags ksicName name');
        console.log(`Scanning ${companies.length} companies...`);

        let updatedCount = 0;
        const bulkOps = [];
        const otherCategories = new Set();

        for (const company of companies) {
            const original = company.industry || '';
            const normalized = normalize(original);

            // Also check ksicName if industry is weak
            let robustNormalized = normalized;
            if (normalized === 'Other' && company.ksicName) {
                const ksicNormalized = normalize(company.ksicName);
                if (ksicNormalized !== 'Other') {
                    robustNormalized = ksicNormalized;
                }
            }

            if (robustNormalized === 'Other') {
                otherCategories.add(original.trim());
            }

            if (original !== robustNormalized) {
                // Determine if we need to update
                // If the current value is already one of our valid categories, and it matches the robustNormalized, we are good.
                // But wait, what if the current value IS a valid category but we re-classified it differently?
                // Let's trust the robustNormalized if it's not 'Other'.

                if (robustNormalized !== 'Other') {
                    const newTags = [...(company.tags || [])];
                    // Preserve original as a tag if it's not generic
                    if (original && original !== robustNormalized && original !== 'Other' && original !== '(Unspecified)' && !newTags.includes(original)) {
                        newTags.push(original);
                    }

                    bulkOps.push({
                        updateOne: {
                            filter: { _id: company._id },
                            update: {
                                $set: { industry: robustNormalized },
                                $addToSet: { tags: { $each: newTags } } // Use $each to be safe
                            }
                        }
                    });
                    updatedCount++;
                }
            }
        }

        if (bulkOps.length > 0) {
            console.log(`Executing ${bulkOps.length} updates...`);
            // Execute in batches of 1000
            const BATCH_SIZE = 1000;
            for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
                const chunk = bulkOps.slice(i, i + BATCH_SIZE);
                await Company.bulkWrite(chunk);
                process.stdout.write(`\rUnpdated: ${Math.min(i + BATCH_SIZE, bulkOps.length)}/${bulkOps.length}`);
            }
            console.log('\nUpdates complete.');
        } else {
            console.log('No updates needed.');
        }

        console.log('--- Unclassified "Other" Samples (First 20) ---');
        console.log(Array.from(otherCategories).slice(0, 20));

        console.log('--- Normalization Finished ---');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
