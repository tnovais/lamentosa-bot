import { NextResponse } from 'next/server';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function POST(req: Request) {
    try {
        const { accountId, type, payload } = await req.json();

        if (!accountId || !type) {
            return NextResponse.json({ error: 'Missing accountId or type' }, { status: 400 });
        }

        const channel = `bot:${accountId}:commands`;
        const command = JSON.stringify({ type, payload });

        await redis.publish(channel, command);
        console.log(`[API] Published command ${type} to ${channel}`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] Command failed:', error);
        return NextResponse.json({ error: 'Failed to send command' }, { status: 500 });
    }
}
