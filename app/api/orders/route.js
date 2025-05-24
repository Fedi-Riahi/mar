import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const prisma = new PrismaClient();

// Define allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  // Add your production frontend URL here, e.g., 'https://your-app.vercel.app'
];

export async function POST(req) {
  const origin = req.headers.get('origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Extract token
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

    // Fetch user
    const user = await prisma.user.findUnique({
      where: { email: token.email },
      select: { id: true },
    });

    if (!user) {
      console.error('Authentication error: User not found', { email: token.email });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Parse cart items
    const { items } = await req.json();
    console.log('Request data:', { items, userId: user.id });

    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      console.error('Validation error: No items provided');
      return NextResponse.json(
        { error: 'No items provided' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check for duplicate productIds
    const productIds = items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      console.error('Validation error: Duplicate product IDs in items');
      return NextResponse.json(
        { error: 'Duplicate product IDs in items' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate products and stock, calculate total
    const orderItemsData = [];
    let totalPrice = 0;

    for (const item of items) {
      const { productId, quantity } = item;

      // Validate item fields
      if (!productId || typeof productId !== 'string' || !quantity || !Number.isInteger(quantity) || quantity < 1) {
        console.error('Validation error: Invalid productId or quantity', { item });
        return NextResponse.json(
          { error: 'Invalid productId or quantity' },
          { status: 400, headers: corsHeaders }
        );
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, price: true, stock: true },
      });

      if (!product) {
        console.error('Product error: Product not found', { productId });
        return NextResponse.json(
          { error: `Product not found: ${productId}` },
          { status: 400, headers: corsHeaders }
        );
      }

      if (product.stock < quantity) {
        console.error('Stock error: Insufficient stock', {
          productId,
          productName: product.name,
          stock: product.stock,
          requested: quantity,
        });
        return NextResponse.json(
          { error: `Insufficient stock for product: ${product.name}` },
          { status: 400, headers: corsHeaders }
        );
      }

      orderItemsData.push({
        productId,
        quantity,
        unitPrice: product.price,
      });
      totalPrice += product.price * quantity;
    }

    // Create order and update stock in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order
      const createdOrder = await tx.order.create({
        data: {
          user: { connect: { id: user.id } },
          totalPrice,
          status: 'PENDING',
          orderItems: {
            create: orderItemsData.map((item) => ({
              product: { connect: { id: item.productId } },
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: {
          orderItems: {
            include: {
              product: { select: { name: true, price: true } },
            },
          },
        },
      });

      // Update stock
      for (const item of orderItemsData) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return createdOrder;
    });

    console.log('Order created successfully:', { orderId: order.id, userId: user.id });
    return NextResponse.json(order, { status: 201, headers: corsHeaders });
  } catch (error) {
    console.error('Order creation error:', {
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: 'Order creation failed', details: error.message },
      { status: 400, headers: corsHeaders }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(req) {
  const origin = req.headers.get('origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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
      select: { id: true },
    });

    if (!user) {
      console.error('Authentication error: User not found', { email: token.email });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders }
      );
    }

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      include: {
        orderItems: {
          include: {
            product: { select: { id: true, name: true, price: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('Orders fetched successfully:', { userId: user.id, count: orders.length });
    return NextResponse.json(orders, { headers: corsHeaders });
  } catch (error) {
    console.error('Fetch orders error:', {
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: 'Failed to fetch orders', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function OPTIONS(req) {
  const origin = req.headers.get("origin");
  const allowedOrigins = [
    "http://localhost:3000",
    "https://your-frontend.vercel.app", // Add production frontend URL
  ];

  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true", // Allow credentials
  };

  return NextResponse.json({}, { headers: corsHeaders });
}
