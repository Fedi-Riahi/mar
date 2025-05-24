import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

const prisma = new PrismaClient();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Define allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  // Add your production frontend URL here, e.g., 'https://your-app.vercel.app'
];

export async function PUT(req, { params }) {
  const origin = req.headers.get('origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'PUT, GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: corsHeaders }
    );
  }

  const productId = params.id;

  try {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const formData = await req.formData();
    const name = formData.get('name');
    const description = formData.get('description');
    const price = formData.get('price');
    const stock = formData.get('stock');
    const category = formData.get('category');
    const images = formData.getAll('images');
    const existingImages = formData.get('existingImages')
      ? JSON.parse(formData.get('existingImages'))
      : [];
    const removedImages = formData.get('removedImages')
      ? JSON.parse(formData.get('removedImages'))
      : [];

    if (!name || !description || !price || !stock || !category) {
      return NextResponse.json(
        { error: 'Missing fields' },
        { status: 400, headers: corsHeaders }
      );
    }

    const pictures = [...existingImages];
    for (const image of images) {
      if (image.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Image size exceeds 10MB' },
          { status: 400, headers: corsHeaders }
        );
      }
      if (image.size > 0) {
        const buffer = Buffer.from(await image.arrayBuffer());
        const stream = Readable.from(buffer);

        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'ecommerce_products' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.pipe(uploadStream);
        });

        pictures.push(result.secure_url);
      }
    }

    for (const imageUrl of removedImages) {
      const publicId = imageUrl.match(/ecommerce_products\/(.+)\.\w+$/)?.[1];
      if (publicId) {
        await cloudinary.uploader.destroy(`ecommerce_products/${publicId}`);
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        name,
        description,
        price: parseFloat(price),
        stock: parseInt(stock, 10),
        category,
        pictures,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(updatedProduct, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Product update error:', error);
    return NextResponse.json(
      { error: 'Product update failed', details: error.message },
      { status: 400, headers: corsHeaders }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(req, { params }) {
  const origin = req.headers.get('origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'PUT, GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404, headers: corsHeaders }
      );
    }
    return NextResponse.json(product, { headers: corsHeaders });
  } catch (error) {
    console.error('Fetch product error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(req, { params }) {
  const origin = req.headers.get('origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'PUT, GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: corsHeaders }
    );
  }

  const productId = params.id;

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { orderItems: true }, // Updated to use orderItems instead of orders
    });
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (product.orderItems.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete product with existing order items' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Delete images from Cloudinary
    for (const imageUrl of product.pictures) {
      const publicId = imageUrl.match(/ecommerce_products\/(.+)\.\w+$/)?.[1];
      if (publicId) {
        await cloudinary.uploader.destroy(`ecommerce_products/${publicId}`);
      }
    }

    // Delete product from database
    await prisma.product.delete({ where: { id: productId } });

    return NextResponse.json(
      { message: 'Product deleted' },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Product deletion error:', error);
    return NextResponse.json(
      { error: 'Product deletion failed', details: error.message },
      { status: 400, headers: corsHeaders }
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
