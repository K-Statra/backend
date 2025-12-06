const { connectDB } = require('./src/config/db');
require('dotenv').config();

// Override MONGODB_URI to cause failure
process.env.MONGODB_URI = 'mongodb://invalid-host:27017/test';

console.log('Starting reproduction script...');

(async () => {
    try {
        await connectDB();
        console.log('Connected (unexpected)');
    } catch (err) {
        console.log('Caught error in main wrapper (unexpected if process.exit is called)');
    }
})();

process.on('exit', (code) => {
    console.log(`Process exiting with code: ${code}`);
});
