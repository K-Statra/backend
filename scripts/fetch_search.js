const http = require('http');
const fs = require('fs');

const url = 'http://localhost:4000/partners/search?q=recommend%20me%20K-beaty%20suppliers%20in%20Korea';

http.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        fs.writeFileSync('response_node.json', data);
        console.log('Response saved to response_node.json');
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
