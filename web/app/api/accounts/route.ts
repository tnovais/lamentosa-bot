import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const accounts = await prisma.account.findMany({
            include: {
                dailyStats: {
                    orderBy: { date: 'desc' },
                    take: 1
                }
            }
        });
        return NextResponse.json(accounts);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const account = await prisma.account.create({
            data: {
                email: body.email,
                password: body.password,
                proxy: body.proxy,
                isActive: true
            }
        });
        return NextResponse.json(account);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { id } = await req.json();
        await prisma.account.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }
}
