const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

try {
    const content = fs.readFileSync(envPath, 'utf8'); // Assuming it's UTF-8 now after first fix
    const lines = content.split(/\r?\n/);
    const envMap = new Map();
    const commentLines = [];

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (trimmed.startsWith('#')) {
            // It's a comment, maybe keep it? 
            // For now, let's just ignore comments to ensure clean file, 
            // or store them if we want to preserve structure (hard with map).
            // Let's just focus on keys.
            return;
        }

        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            // Overwrite with latest value
            envMap.set(key, value);
        }
    });

    // Explicitly ensure TAVILY_API_KEY is clean
    if (envMap.has('TAVILY_API_KEY')) {
        let val = envMap.get('TAVILY_API_KEY');
        // Remove any trailing garbage if present
        val = val.replace(/[^\w\-\.]+$/, '');
        envMap.set('TAVILY_API_KEY', val);
    }

    let newContent = '';
    for (const [key, value] of envMap) {
        newContent += `${key}=${value}\n`;
    }

    fs.writeFileSync(envPath, newContent, 'utf8');
    console.log('Successfully rewrote .env file.');
    console.log('Keys found:', Array.from(envMap.keys()).join(', '));

} catch (e) {
    console.error('Failed to rewrite .env:', e.message);
}
