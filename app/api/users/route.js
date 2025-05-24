import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";

const prisma = new PrismaClient();

// Define allowed origins for CORS
const allowedOrigins = [
  "http://localhost:3000",
  // Add your production frontend URL here, e.g., "https://your-app.vercel.app"
];

export async function POST(req) {
  const origin = req.headers.get("origin");
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

   try {
    const {
      fullName,
      email,
      phone,
      businessName,
      bio,
      location,
      password,
    } = await req.json();

    // Validate required fields
    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: "Full name, email, and password are required" },
        { status: 400, headers : corsHeaders }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409, headers : corsHeaders }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with artisan application data
    const user = await prisma.user.create({
      data: {
        email,
        name: fullName,
        password: hashedPassword,
        phone: phone ? parseInt(phone) : null,
        businessName: businessName || null,
        bio: bio || null,
        location: location || null,
        role: "ARTISAN_PENDING",
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.role === "ARTISAN_PENDING" ? "PENDING" : undefined,
      },
      { status: 201, headers : corsHeaders }
    );
  } catch (error) {
    console.error("User creation error:", error);
    return NextResponse.json(
      { error: "User creation failed", details: error.message },
      { status: 500, headers : corsHeaders }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(req) {
  const origin = req.headers.get("origin");
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403, headers: corsHeaders }
      );
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        location: true,
        createdAt: true,
      },
    });

    return NextResponse.json(users, { headers: corsHeaders });
  } catch (error) {
    console.error("Fetch users error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users", details: error.message },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function OPTIONS() {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*", // Allow all origins for OPTIONS to simplify preflight
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  return NextResponse.json({}, { headers: corsHeaders });
}
