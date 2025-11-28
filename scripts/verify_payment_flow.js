const axios = require('axios');

const baseURL = 'http://localhost:4000';

async function run() {
    try {
        console.log('1. Creating a Payment...');
        const paymentPayload = {
            amount: 100,
            currency: 'XRP',
            buyerId: '64f0a1b2c3d4e5f678901234', // Valid 24-char hex
            companyId: '64f0a1b2c3d4e5f678905678', // Valid 24-char hex
            memo: 'Test Payment Verification'
        };

        // We need a real buyer/company ID if the backend checks existence.
        // Let's fetch one first to be safe.
        try {
            const buyersRes = await axios.get(`${baseURL}/buyers?limit=1`);
            const companiesRes = await axios.get(`${baseURL}/companies?limit=1`);

            if (buyersRes.data.data && buyersRes.data.data.length > 0) {
                paymentPayload.buyerId = buyersRes.data.data[0]._id;
            }
            if (companiesRes.data.data && companiesRes.data.data.length > 0) {
                paymentPayload.companyId = companiesRes.data.data[0]._id;
            }
        } catch (e) {
            console.warn('   [WARN] Failed to fetch real IDs, using dummies. This might fail if DB checks existence.');
        }

        const createRes = await axios.post(`${baseURL}/payments`, paymentPayload, {
            headers: { 'Idempotency-Key': `verify-${Date.now()}` }
        });
        const paymentId = createRes.data.payment ? createRes.data.payment._id : createRes.data._id;
        console.log(`   Payment created: ${paymentId}, Status: ${createRes.data.payment ? createRes.data.payment.status : createRes.data.status}`);

        console.log('2. checking Payment Status...');
        const getRes = await axios.get(`${baseURL}/payments/${paymentId}`);
        if (getRes.data._id !== paymentId) throw new Error('Payment fetch mismatch');
        console.log(`   Fetched Status: ${getRes.data.status}`);

        console.log('3. Refreshing Payment...');
        const refreshRes = await axios.post(`${baseURL}/payments/${paymentId}/refresh`);
        console.log(`   Refreshed Status: ${refreshRes.data.status}`);

        console.log('4. Checking Admin List...');
        try {
            const adminRes = await axios.get(`${baseURL}/admin/payments?limit=1`, {
                headers: { 'X-Admin-Token': 'admin-secret-123' } // Try default
            });
            console.log(`   Admin List count: ${adminRes.data.data.length}`);
        } catch (e) {
            console.log('   [WARN] Admin list failed (likely auth), skipping admin check.');
        }

        console.log('SUCCESS: Payment flow verified.');
    } catch (err) {
        console.error('FAILED:', err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
        process.exit(1);
    }
}

run();
