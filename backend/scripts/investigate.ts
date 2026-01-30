import { AppDataSource } from '../src/data-source';
import { Conversation } from '../src/modules/conversations/entities/conversation.entity';
import { ConversationMessage } from '../src/modules/conversations/entities/conversation-message.entity';
import { ReasoningTrace } from '../src/modules/agents/entities/reasoning-trace.entity';

async function main() {
    const command = process.argv[2];
    const arg = process.argv[3];

    await AppDataSource.initialize();

    try {
        switch (command) {
            case 'list-recent':
                await listRecent();
                break;
            case 'search':
                await search(arg);
                break;
            case 'thread':
                await showThread(arg);
                break;
            case 'traces':
                await showTraces(arg);
                break;
            default:
                console.log('Usage: npx ts-node scripts/investigate.ts <command> [arg]');
                console.log('Commands:');
                console.log('  list-recent       List last 20 conversations');
                console.log('  search <query>    Search messages for keywords');
                console.log('  thread <id>      Show full transcript of a thread');
                console.log('  traces <id>      Show reasoning traces for a thread');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await AppDataSource.destroy();
    }
}

async function listRecent() {
    const conversations = await AppDataSource.getRepository(Conversation).find({
        order: { updatedAt: 'DESC' },
        take: 20,
    });

    console.log('\n--- Recent Conversations ---');
    conversations.forEach((c) => {
        console.log(`[${c.id}] ${c.title || 'No Title'} (${c.updatedAt.toLocaleString()})`);
    });
}

async function search(query: string) {
    if (!query) {
        console.log('Please provide a search query.');
        return;
    }

    const messages = await AppDataSource.getRepository(ConversationMessage).createQueryBuilder('m')
        .where('m.content ILIKE :query', { query: `%${query}%` })
        .orderBy('m.createdAt', 'DESC')
        .limit(20)
        .getMany();

    console.log(`\n--- Search results for: "${query}" ---`);
    messages.forEach((m) => {
        console.log(`[${m.threadId}] [${m.type}] ${m.content.substring(0, 100)}...`);
    });
}

async function showThread(threadId: string) {
    if (!threadId) {
        console.log('Please provide a thread ID.');
        return;
    }

    const messages = await AppDataSource.getRepository(ConversationMessage).find({
        where: { threadId },
        order: { sequence: 'ASC' },
    });

    console.log(`\n--- Transcript for Thread: ${threadId} ---`);
    messages.forEach((m) => {
        console.log(`\n[${m.type.toUpperCase()}] (${m.createdAt.toLocaleString()}):`);
        console.log(m.content);
        console.log('-'.repeat(40));
    });
}

async function showTraces(threadId: string) {
    if (!threadId) {
        console.log('Please provide a thread ID.');
        return;
    }

    const traces = await AppDataSource.getRepository(ReasoningTrace).find({
        where: { threadId },
        order: { stepIndex: 'ASC', createdAt: 'ASC' },
    });

    console.log(`\n--- Reasoning Traces for Thread: ${threadId} ---`);
    traces.forEach((t) => {
        console.log(`\n[STEP ${t.stepIndex ?? '?'}] Node: ${t.nodeName} (${t.status})`);
        if (t.input && Object.keys(t.input).length > 0) {
            console.log('Input:', JSON.stringify(t.input).substring(0, 2000) + (JSON.stringify(t.input).length > 2000 ? '...' : ''));
        }
        if (t.reasoning) {
            console.log('Reasoning:', t.reasoning);
        }
        if (t.toolResults && t.toolResults.length > 0) {
            console.log('Tool Calls:');
            t.toolResults.forEach(res => {
                console.log(`  - Tool: ${res.tool}`);
                console.log(`    Result: ${JSON.stringify(res.result).substring(0, 200)}${JSON.stringify(res.result).length > 200 ? '...' : ''}`);
            });
        }
        console.log('-'.repeat(40));
    });
}

main();
