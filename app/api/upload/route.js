import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

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

// Define allowed file types
const allowedFileTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(request) {
  const origin = request.headers.get('origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const formData = await request.formData();
    const files = formData.getAll('files');

    // Validate files
    if (!files || files.length === 0 || files[0].size === 0) {
      return NextResponse.json(
        { error: 'At least one file is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const urls = [];
    for (const file of files) {
      // Validate file type
      if (!allowedFileTypes.includes(file.type)) {
        return NextResponse.json(
          {
            error: `Invalid file type for ${file.name}. Allowed types: ${allowedFileTypes.join(', ')}`,
          },
          { status: 400, headers: corsHeaders }
        );
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds 10MB limit` },
          { status: 400, headers: corsHeaders }
        );
      }

      // Upload to Cloudinary
      const buffer = Buffer.from(await file.arrayBuffer());
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

      urls.push(result.secure_url);
    }

    return NextResponse.json({ urls }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'File upload failed', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Allow all origins for OPTIONS to simplify preflight
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  return NextResponse.json({}, { headers: corsHeaders });
}
