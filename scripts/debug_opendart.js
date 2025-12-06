const OpenDart = require('opendart');
console.log('Type of OpenDart:', typeof OpenDart);
console.log('OpenDart exports:', OpenDart);
const apiKey = process.env.OPENDART_API_KEY || '7396e78da6425f8da7f8af91d9833b63b6816871';

console.log('Testing Open DART API with key:', apiKey.substring(0, 5) + '...');

// Test 1: Fetch Company List (CorpCode)
const samsungCorpCode = '00126380'; // Samsung Electronics

async function testApi() {
    try {
        console.log('Attempting to fetch company details for:', samsungCorpCode);
        const result = await OpenDart.disclosure.company(apiKey, { corp_code: samsungCorpCode });
        console.log('API Call Result:', JSON.stringify(result.data, null, 2));

        if (result.data && result.data.status === '000') {
            console.log('SUCCESS: API Key is valid and working.');
        } else {
            console.log('FAILURE: API returned error status.');
        }
    } catch (error) {
        console.error('ERROR: API call failed:', error);
    }
}

// Test 2: Fetch Financial Data (Samsung Electronics, 2023, Annual Report)
async function testFinancials() {
    try {
        console.log('Attempting to fetch financial data for:', samsungCorpCode);
        // fnlttSinglAcnt(apiKey, { corp_code, bsns_year, reprt_code })
        // reprt_code: 11011 (Business Report - Annual)
        const result = await OpenDart.statement.fnlttSinglAcnt(apiKey, {
            corp_code: samsungCorpCode,
            bsns_year: '2023',
            reprt_code: '11011'
        });

        console.log('Financial API Call Result:', JSON.stringify(result.data, null, 2));
    } catch (error) {
        console.error('ERROR: Financial API call failed:', error);
    }
}

testApi().then(testFinancials);
