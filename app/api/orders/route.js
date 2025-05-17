import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    // Extract the token using getToken
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    console.log("Orders POST - Headers:", Object.fromEntries(req.headers));
    console.log("Orders POST - Token:", JSON.stringify(token, null, 2));

    if (!token || !token.email) {
      console.error("Authentication error: No valid token or email");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user from database using email
    const user = await prisma.user.findUnique({
      where: { email: token.email },
      select: { id: true },
    });

    if (!user) {
      console.error("Authentication error: User not found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Proceed with order creation
    const { productId, quantity } = await req.json();
    console.log("Request data:", { productId, quantity, userId: user.id });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.stock < quantity) {
      console.error("Product error:", !product ? "Product not found" : "Insufficient stock");
      return NextResponse.json({ error: "Invalid product or insufficient stock" }, { status: 400 });
    }

    const totalPrice = product.price * quantity;
    const order = await prisma.order.create({
      data: {
        user: { connect: { id: user.id } },
        product: { connect: { id: productId } },
        quantity,
        totalPrice,
        status: "PENDING",
      },
    });

    await prisma.product.update({
      where: { id: productId },
      data: { stock: product.stock - quantity },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Order creation error:", error);
    return NextResponse.json({ error: "Order creation failed" }, { status: 400 });
  }
}

export async function GET(req) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    console.log("Orders GET - Token:", JSON.stringify(token, null, 2));

    if (!token || !token.email) {
      console.error("Authentication error: No valid token or email");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: token.email },
      select: { id: true },
    });

    if (!user) {
      console.error("Authentication error: User not found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      include: { product: { select: { name: true, price: true } } },
    });
    return NextResponse.json(orders);
  } catch (error) {
    console.error("Fetch orders error:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}