import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const prisma = new PrismaClient();

export async function DELETE(req, { params }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orderId } = await params; // Await params to resolve id

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    await prisma.order.delete({ where: { id: orderId } });

    return NextResponse.json({ message: 'Order deleted' }, { status: 200 });
  } catch (error) {
    console.error('Order deletion error:', error);
    return NextResponse.json({ error: 'Order deletion failed' }, { status: 400 });
  }
}

export async function PATCH(req, { params }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orderId } = await params; // Await params to resolve id

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { status } = await req.json();
    if (!['PENDING', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    return NextResponse.json(updatedOrder, { status: 200 });
  } catch (error) {
    console.error('Order status update error:', error);
    return NextResponse.json({ error: 'Order status update failed' }, { status: 400 });
  }
}