/**
 * K-Statra Macro Industry Categories
 * Based on KSIC (Korean Standard Industrial Classification) codes.
 */

const INDUSTRIES = {
    IT_AI_SAAS: 'IT / AI / SaaS',
    BIO_HEALTHCARE: 'Healthcare / Bio / Medical',
    GREEN_ENERGY: 'Green Energy / Climate Tech / Smart City',
    MOBILITY_MANUFACTURING: 'Mobility / Automation / Manufacturing',
    BEAUTY_CONSUMER: 'Beauty / Consumer Goods / Food',
    CONTENT_CULTURE: 'Content / Culture / Edutech',
    FINTECH_FINANCE: 'Fintech / Smart Finance',
    OTHER: 'Other'
};

/**
 * Maps a KSIC (standard industry classification) code and text to a macro category.
 * @param {string} ksicCode - The KSIC code from DART (e.g., "62010").
 * @param {string} ksicName - The KSIC name from DART (e.g., "컴퓨터 프로그래밍 서비스업").
 * @param {string} corpName - Company name for keyword fallback.
 * @returns {string} One of the INDUSTRIES values.
 */
function mapIndustry(ksicCode, ksicName, corpName) {
    if (!ksicCode) return INDUSTRIES.OTHER;

    const code = ksicCode.toString();
    const name = (ksicName || '').toLowerCase();
    const cName = (corpName || '').toLowerCase();

    // 1. Bio / Healthcare
    // 21: 의약품
    // 27: 의료 정밀 기기 (some parts)
    // 721: 연구개발 (Biotech often falls here)
    if (code.startsWith('21')) return INDUSTRIES.BIO_HEALTHCARE;
    if (code.startsWith('27') && (name.includes('의료') || name.includes('기기'))) return INDUSTRIES.BIO_HEALTHCARE;
    if (name.includes('바이오') || name.includes('제약') || name.includes('병원')) return INDUSTRIES.BIO_HEALTHCARE;

    // 2. IT / AI / SaaS
    // 26: 전자부품, 컴퓨터, 통신장비
    // 58: 출판 (소프트웨어 퍼블리싱)
    // 62: 컴퓨터 프로그래밍, 시스템 통합
    // 63: 정보서비스 (포털, 데이터 등)
    if (code.startsWith('26')) return INDUSTRIES.IT_AI_SAAS; // Hardware/Semi often here, could be Manufacturing too, but High-tech
    if (code.startsWith('582')) return INDUSTRIES.IT_AI_SAAS; // SW publishing
    if (code.startsWith('62')) return INDUSTRIES.IT_AI_SAAS;
    if (code.startsWith('63')) return INDUSTRIES.IT_AI_SAAS;
    if (name.includes('소프트웨어') || name.includes('플랫폼') || name.includes('ai') || name.includes('인공지능')) return INDUSTRIES.IT_AI_SAAS;

    // 3. Green Energy / Climate
    // 35: 전기, 가스, 증기 (Energy)
    // 38: 폐기물 (Recycling)
    if (code.startsWith('35')) return INDUSTRIES.GREEN_ENERGY;
    if (code.startsWith('38')) return INDUSTRIES.GREEN_ENERGY;
    if (name.includes('에너지') || name.includes('환경') || name.includes('태양광') || name.includes('탄소')) return INDUSTRIES.GREEN_ENERGY;

    // 4. Fintech
    // 64: 금융
    // 65: 보험
    // 66: 금융 보조
    if (code.startsWith('64') || code.startsWith('65') || code.startsWith('66')) return INDUSTRIES.FINTECH_FINANCE;
    if (name.includes('투자') || name.includes('금융') || name.includes('핀테크')) return INDUSTRIES.FINTECH_FINANCE;

    // 5. Beauty / Consumer / Food
    // 10: 식료품
    // 11: 음료
    // 204: 기타 화학 (세제, 화장품 등) -> Need careful check
    // 47: 소매 (Retail)
    if (code.startsWith('10') || code.startsWith('11')) return INDUSTRIES.BEAUTY_CONSUMER;
    if (code.startsWith('204')) return INDUSTRIES.BEAUTY_CONSUMER; // Soaps, detergents, cosmetics
    if (name.includes('화장품') || name.includes('코스메틱') || name.includes('뷰티') || name.includes('식품') || name.includes('푸드')) return INDUSTRIES.BEAUTY_CONSUMER;

    // 6. Content / Culture / Edutech
    // 59: 영상, 오디오, 기록물
    // 90: 창작, 예술
    // 91: 도서관, 박물관
    // 85: 교육
    if (code.startsWith('59') || code.startsWith('90') || code.startsWith('91')) return INDUSTRIES.CONTENT_CULTURE;
    if (code.startsWith('85')) return INDUSTRIES.CONTENT_CULTURE; // Edutech
    if (name.includes('에듀') || name.includes('교육') || name.includes('게임') || name.includes('엔터테인먼트')) return INDUSTRIES.CONTENT_CULTURE;

    // 7. Mobility / Automation / Manufacturing (Default for heavy industry)
    // 29: 자동차
    // 30: 기타 운송장비
    // 31: 가구 (Manufacturing)
    // 24, 25: Metal
    // 28: Machinery
    if (code.startsWith('29') || code.startsWith('30')) return INDUSTRIES.MOBILITY_MANUFACTURING;
    if (code.startsWith('24') || code.startsWith('25') || code.startsWith('28')) return INDUSTRIES.MOBILITY_MANUFACTURING;
    if (name.includes('자동차') || name.includes('모터스') || name.includes('중공업') || name.includes('기계')) return INDUSTRIES.MOBILITY_MANUFACTURING;

    // Fallback logic
    if (code.startsWith('C')) return INDUSTRIES.MOBILITY_MANUFACTURING; // Manufacturing Section C

    return INDUSTRIES.OTHER;
}

module.exports = { INDUSTRIES, mapIndustry };
