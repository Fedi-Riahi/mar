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

export async function POST(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Parse form data using NextRequest.formData()
    const formData = await req.formData();
    const name = formData.get('name');
    const description = formData.get('description');
    const price = formData.get('price');
    const stock = formData.get('stock');
    const images = formData.getAll('images');

    // Validate fields
    if (!name || !description || !price || !stock) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (images.length === 0 || images[0].size === 0) {
      return NextResponse.json({ error: 'At least one image is required' }, { status: 400 });
    }

    // Handle image uploads to Cloudinary
    const pictures = [];
    for (const image of images) {
      if (image.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image size exceeds 10MB' }, { status: 400 });
      }

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

    // Create product
    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        pictures,
        stock: parseInt(stock, 10),
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Product creation error:', error);
    return NextResponse.json({ error: 'Product creation failed' }, { status: 400 });
  }
}

export async function GET() {
  try {
    const products = await prisma.product.findMany();
    return NextResponse.json(products);
  } catch (error) {
    console.error('Fetch products error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}