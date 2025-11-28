const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { FormData } = require('axios');

const baseURL = 'http://localhost:4000';

async function run() {
    try {
        console.log('1. Creating temporary company...');
        const companyRes = await axios.post(`${baseURL}/companies`, {
            name: 'Test Company For Images',
            industry: 'Testing',
        });
        const companyId = companyRes.data._id;
        console.log(`   Company created: ${companyId}`);

        console.log('2. Creating dummy image file...');
        const imagePath = path.join(__dirname, 'test_image.jpg');
        fs.writeFileSync(imagePath, 'dummy image content');

        console.log('3. Uploading image...');
        let FormData;
        try {
            FormData = require('form-data');
        } catch (e) {
            console.log('   form-data package not found, trying to use internal axios one or fail.');
        }

        if (!FormData) {
            FormData = require('form-data');
        }

        const form = new FormData();
        form.append('image', fs.createReadStream(imagePath));
        form.append('caption', 'Test Caption');

        const uploadRes = await axios.post(`${baseURL}/companies/${companyId}/images`, form, {
            headers: {
                ...form.getHeaders(),
            },
        });
        const imageId = uploadRes.data._id;
        console.log(`   Image uploaded: ${imageId}, URL: ${uploadRes.data.url}`);

        console.log('4. Listing images...');
        const listRes = await axios.get(`${baseURL}/companies/${companyId}/images`);
        const images = listRes.data;
        console.log(`   Images found: ${images.length}`);

        // Check if uploaded image exists
        const uploadedImage = images.find(img => img._id === imageId);
        if (!uploadedImage) {
            throw new Error('Uploaded image not found in list');
        }

        console.log('5. Deleting image...');
        await axios.delete(`${baseURL}/companies/${companyId}/images/${imageId}`);
        console.log('   Image deleted');

        console.log('6. Verifying deletion...');
        const listRes2 = await axios.get(`${baseURL}/companies/${companyId}/images`);
        const deletedImage = listRes2.data.find(img => img._id === imageId);
        if (deletedImage) {
            throw new Error('Image should be gone');
        }

        console.log('7. Cleaning up company...');
        await axios.delete(`${baseURL}/companies/${companyId}`);
        console.log('   Company deleted');

        console.log('8. Cleaning up temp file...');
        fs.unlinkSync(imagePath);

        console.log('SUCCESS: All image tests passed.');
    } catch (err) {
        console.error('FAILED:', err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
        process.exit(1);
    }
}

run();
