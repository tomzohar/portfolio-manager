import * as fs from 'fs';
import * as path from 'path';

interface Memory {
    content: string;
    createdAt: string;
}

async function main() {
    const fact = process.argv[2];
    if (!fact) {
        console.error('Usage: npx ts-node scripts/remember.ts "the fact to remember"');
        process.exit(1);
    }

    // Target directory: root .agent folder
    const memoryDir = path.resolve(__dirname, '../../.agent');
    const memoryFile = path.join(memoryDir, 'memories.json');

    try {
        if (!fs.existsSync(memoryDir)) {
            fs.mkdirSync(memoryDir, { recursive: true });
        }

        let memories: Memory[] = [];
        if (fs.existsSync(memoryFile)) {
            const content = fs.readFileSync(memoryFile, 'utf8');
            try {
                memories = JSON.parse(content);
                if (!Array.isArray(memories)) {
                    memories = [];
                }
            } catch (e) {
                console.warn('⚠️ memories.json was corrupted, overwriting with fresh array.');
                memories = [];
            }
        }

        memories.push({
            content: fact,
            createdAt: new Date().toISOString(),
        });

        fs.writeFileSync(memoryFile, JSON.stringify(memories, null, 2));
        console.log(`✅ Successfully remembered: "${fact}"`);
    } catch (error) {
        console.error('❌ Error saving memory:', error);
        process.exit(1);
    }
}

main();
