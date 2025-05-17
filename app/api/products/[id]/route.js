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

export async function PUT(req, { params }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const productId = params.id;

  try {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const name = formData.get('name');
    const description = formData.get('description');
    const price = formData.get('price');
    const stock = formData.get('stock');
    const images = formData.getAll('images');
    const existingImages = formData.get('existingImages') ? JSON.parse(formData.get('existingImages')) : [];
    const removedImages = formData.get('removedImages') ? JSON.parse(formData.get('removedImages')) : [];

    if (!name || !description || !price || !stock) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const pictures = [...existingImages];
    for (const image of images) {
      if (image.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image size exceeds 10MB' }, { status: 400 });
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
        pictures,
      },
    });

    return NextResponse.json(updatedProduct, { status: 200 });
  } catch (error) {
    console.error('Product update error:', error);
    return NextResponse.json({ error: 'Product update failed' }, { status: 400 });
  }
}

export async function GET(req, { params }) {
  try {
    const product = await prisma.product.findUnique({ where: { id: params.id } });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (error) {
    console.error('Fetch product error:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const productId = params.id;

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { orders: true },
    });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (product.orders.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete product with existing orders' },
        { status: 400 }
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

    return NextResponse.json({ message: 'Product deleted' }, { status: 200 });
  } catch (error) {
    console.error('Product deletion error:', error);
    return NextResponse.json({ error: 'Product deletion failed' }, { status: 400 });
  }
}