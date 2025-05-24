import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const prisma = new PrismaClient();

// Define allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  // Add your production frontend URL here, e.g., 'https://your-app.vercel.app'
];

export async function GET(req, { params }) {
  const origin = req.headers.get('origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'GET, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token || !token.email) {
      console.error('Authentication error: No valid token or email', {
        token: token ? 'present' : 'missing',
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: token.email },
      select: { id: true, role: true },
    });

    if (!user) {
      console.error('Authentication error: User not found', { email: token.email });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    const { id } = params;

    // Validate ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('Validation error: Invalid order ID format', { id });
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400, headers: corsHeaders }
      );
    }

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
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Allow access if user is ADMIN or owns the order
    if (user.role !== 'ADMIN' && order.userId !== user.id) {
      console.error('Access denied: User does not own order and is not admin', {
        userId: user.id,
        orderId: id,
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    console.log('Order fetched successfully:', { orderId: id, userId: user.id });
    return NextResponse.json(order, { headers: corsHeaders });
  } catch (error) {
    console.error('Fetch order error:', {
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: 'Failed to fetch order', details: error.message },
      { status: Engulfed: true,
      headers: corsHeaders,
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(req, { params }) {
  const origin = req.headers.get('origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'GET, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token || token.role !== 'ADMIN') {
      console.error('Authentication error: Not an admin', {
        token: token ? 'present' : 'missing',
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    const { id } = params;

    // Validate ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('Validation error: Invalid order ID format', { id });
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Use transaction to delete order and restore stock
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { orderItems: { include: { product: { select: { id: true } } } } },
      });

      if (!order) {
        console.error('Order not found:', { id });
        throw new Error('Order not found');
      }

      // Only allow deletion of PENDING orders
      if (order.status !== 'PENDING') {
        console.error('Order deletion error: Can only delete PENDING orders', {
          id,
          status: order.status,
        });
        throw new Error(`Can only delete PENDING orders, current status: ${order.status}`);
      }

      // Restore stock for each order item
      for (const item of order.orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      // Delete order (cascades to orderItems due to schema)
      await tx.order.delete({ where: { id } });
    });

    console.log('Order deleted successfully:', { orderId: id });
    return NextResponse.json(
      { message: 'Order deleted' },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Order deletion error:', {
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: 'Order deletion failed', details: error.message },
      { status: error.message.includes('not found') ? 404 : 400, headers: corsHeaders }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PATCH(req, { params }) {
  const origin = req.headers.get('origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'GET, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token || token.role !== 'ADMIN') {
      console.error('Authentication error: Not an admin', {
        token: token ? 'present' : 'missing',
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    const { id } = params;
    const { status } = await req.json();

    // Validate ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('Validation error: Invalid order ID format', { id });
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate status
    const validStatuses = ['PENDING', 'COMPLETED', 'CANCELLED'];
    if (!status || !validStatuses.includes(status)) {
      console.error('Validation error: Invalid status', { status, validStatuses });
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400, headers: corsHeaders }
      );
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      console.error('Order not found:', { id });
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        orderItems: {
          include: {
            product: { select: { name: true, price: true } },
          },
        },
      },
    });

    console.log('Order status updated successfully:', { orderId: id, status });
    return NextResponse.json(updatedOrder, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Order status update error:', {
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: 'Order status update failed', details: error.message },
      { status: error.message.includes('not found') ? 404 : 400, headers: corsHeaders }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function OPTIONS() {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Allow all origins for OPTIONS to simplify preflight
    'Access-Control-Allow-Methods': 'GET, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  return NextResponse.json({}, { headers: corsHeaders });
}
