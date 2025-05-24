import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '../../auth/[...nextauth]/route';

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
    'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403, headers: corsHeaders }
      );
    }

    const { id } = params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(user, { headers: corsHeaders });
  } catch (error) {
    console.error('Fetch user error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PATCH(req, { params }) {
  const origin = req.headers.get('origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403, headers: corsHeaders }
      );
    }

    const { id } = params;
    const { role } = await req.json();

    // Validate role
    const validRoles = ['USER', 'ARTISAN', 'ADMIN'];
    if (!role || !validRoles.includes(role.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role: role.toUpperCase() },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    return NextResponse.json(user, { headers: corsHeaders });
  } catch (error) {
    console.error('Update user role error:', error);
    return NextResponse.json(
      { error: 'Failed to update user role', details: error.message },
      { status: 400, headers: corsHeaders }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(req, { params }) {
  const origin = req.headers.get('origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403, headers: corsHeaders }
      );
    }

    const { id } = params;

    // Check if user exists and has dependencies
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        products: true,
        orders: true,
        tickets: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Prevent deletion if user has related records
    if (user.products.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete user with associated products' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (user.orders.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete user with associated orders' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (user.tickets.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete user with associated tickets' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Prevent deletion of self
    if (session.user.id === id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400, headers: corsHeaders }
      );
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json(
      { message: 'User deleted successfully' },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user', details: error.message },
      { status: 400, headers: corsHeaders }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function OPTIONS() {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Allow all origins for OPTIONS to simplify preflight
    'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  return NextResponse.json({}, { headers: corsHeaders });
}
