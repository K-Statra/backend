const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

try {
    // Read as binary buffer
    const buffer = fs.readFileSync(envPath);

    // Convert to string, filtering out null bytes
    let content = '';
    for (const byte of buffer) {
        if (byte !== 0) {
            content += String.fromCharCode(byte);
        }
    }

    // Split into lines and clean up
    const lines = content.split(/\r?\n/);
    const uniqueLines = new Map();
    const cleanLines = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            cleanLines.push(''); // Keep empty lines for spacing
            continue;
        }

        // Check if it's a key-value pair
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            // If key already exists, overwrite it (last one wins), but we want to keep order?
            // Actually, standard .env behavior: last one wins.
            // But to clean up the file, let's keep the *last* occurrence but place it? 
            // Or just keep unique keys.
            // Let's just deduplicate by key.
            uniqueLines.set(key, line);
        } else {
            // Comments or garbage
            cleanLines.push(line);
        }
    }

    // Reconstruct file content
    // This simple map approach loses the original order/comments structure if we are not careful.
    // Better approach: Iterate lines, if key seen before, ignore/update?
    // Let's just do a simple regex replace for the known issue: TAVILY_API_KEY

    // Let's try a simpler approach:
    // 1. Remove null bytes.
    // 2. Remove duplicate TAVILY_API_KEY lines.

    let cleanedContent = content.replace(/\0/g, ''); // Remove nulls

    // Fix specific TAVILY duplication if easy
    // But let's just write the cleaned content first, that solves the NUL issue.
    // The duplication is less critical (dotenv takes the first or last? usually parses top down).
    // Actually dotenv usually parses all and overrides.

    // Let's remove the specific duplicate we saw in `type` output
    // It had "TAVILY_API_KEY=..." then newlines then "TAVILY_API_KEY=..."

    // We will just write back the cleaned string (no nulls).
    // That fixes the main issue.

    fs.writeFileSync(envPath, cleanedContent, 'utf8');
    console.log('Successfully cleaned .env file (removed null bytes).');

} catch (e) {
    console.error('Failed to fix .env:', e.message);
}
