import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    // Extract the token
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    console.log('Orders POST - Headers:', Object.fromEntries(req.headers));
    console.log('Orders POST - Token:', JSON.stringify(token, null, 2));

    if (!token || !token.email) {
      console.error('Authentication error: No valid token or email');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user
    const user = await prisma.user.findUnique({
      where: { email: token.email },
      select: { id: true },
    });

    if (!user) {
      console.error('Authentication error: User not found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse cart items from request body
    const { items } = await req.json(); // Expecting items: [{ productId, quantity }, ...]
    console.log('Request data:', { items, userId: user.id });

    if (!Array.isArray(items) || items.length === 0) {
      console.error('Validation error: No items provided');
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    // Validate products and stock
    const orderItemsData = [];
    let totalPrice = 0;

    for (const item of items) {
      const { productId, quantity } = item;
      if (!productId || !quantity || quantity < 1) {
        console.error('Validation error: Invalid productId or quantity', item);
        return NextResponse.json({ error: 'Invalid productId or quantity' }, { status: 400 });
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        console.error('Product error: Product not found', { productId });
        return NextResponse.json({ error: `Product not found: ${productId}` }, { status: 400 });
      }

      if (product.stock < quantity) {
        console.error('Stock error: Insufficient stock', { productId, stock: product.stock, quantity });
        return NextResponse.json({ error: `Insufficient stock for product: ${product.name}` }, { status: 400 });
      }

      orderItemsData.push({
        productId,
        quantity,
        unitPrice: product.price,
      });
      totalPrice += product.price * quantity;
    }

    // Create order with order items
    const order = await prisma.order.create({
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
      include: { orderItems: { include: { product: { select: { name: true, price: true } } } } },
    });

    // Update product stock
    for (const item of orderItemsData) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json({ error: 'Order creation failed' }, { status: 400 });
  }
}

export async function GET(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    console.log('Orders GET - Token:', JSON.stringify(token, null, 2));

    if (!token || !token.email) {
      console.error('Authentication error: No valid token or email');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: token.email },
      select: { id: true },
    });

    if (!user) {
      console.error('Authentication error: User not found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Fetch orders error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
