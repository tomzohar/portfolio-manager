import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { ReasoningTrace } from '../src/modules/agents/entities/reasoning-trace.entity';
import { ConversationMessage } from '../src/modules/conversations/entities/conversation-message.entity';
import { Conversation } from '../src/modules/conversations/entities/conversation.entity';

config();

async function main() {
    const threadId = process.argv[2];
    if (!threadId) {
        console.log('Usage: npx ts-node scripts/dump-traces.ts <threadId>');
        return;
    }

    const ds = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'stocks_researcher',
        entities: [ReasoningTrace, ConversationMessage, Conversation],
        synchronize: false,
    });

    await ds.initialize();

    try {
        const traces = await ds.getRepository(ReasoningTrace).find({
            where: { threadId },
            order: { createdAt: 'ASC' },
        });

        console.log(`\n--- Reasoning Traces for Thread: ${threadId} ---`);
        traces.forEach((t) => {
            console.log(`\n[Node: ${t.nodeName}] [Status: ${t.status}] [Created: ${t.createdAt.toISOString()}]`);
            console.log('Reasoning:', t.reasoning);
            if (t.toolResults && t.toolResults.length > 0) {
                console.log('Tool Results:', JSON.stringify(t.toolResults, null, 2));
            }
            if (t.error) {
                console.log('Error:', t.error);
            }
            console.log('-'.repeat(40));
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await ds.destroy();
    }
}

main();
