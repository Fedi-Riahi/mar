import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const prisma = new PrismaClient();

export async function GET(req, { params }) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    console.log('Order GET - Token:', JSON.stringify(token, null, 2));

    if (!token || !token.email) {
      console.error('Authentication error: No valid token or email');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: token.email },
      select: { id: true, role: true },
    });

    if (!user) {
      console.error('Authentication error: User not found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            product: { select: { id: true, name: true, price: true } },
          },
        },
      },
    });

    if (!order) {
      console.error('Order not found:', { id });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Allow access if user is ADMIN or the order belongs to the user
    if (user.role !== 'ADMIN' && order.userId !== user.id) {
      console.error('Access denied: User does not own order and is not admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Fetch order error:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token || token.role !== 'ADMIN') {
      console.error('Authentication error: Not an admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      console.error('Order not found:', { id });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    await prisma.order.delete({ where: { id } });

    return NextResponse.json({ message: 'Order deleted' }, { status: 200 });
  } catch (error) {
    console.error('Order deletion error:', error);
    return NextResponse.json({ error: 'Order deletion failed' }, { status: 400 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token || token.role !== 'ADMIN') {
      console.error('Authentication error: Not an admin');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const { status } = await req.json();

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      console.error('Order not found:', { id });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!['PENDING', 'COMPLETED', 'CANCELLED'].includes(status)) {
      console.error('Invalid status:', { status });
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
      include: { orderItems: { include: { product: { select: { name: true, price: true } } } } },
    });

    return NextResponse.json(updatedOrder, { status: 200 });
  } catch (error) {
    console.error('Order status update error:', error);
    return NextResponse.json({ error: 'Order status update failed' }, { status: 400 });
  }
}
