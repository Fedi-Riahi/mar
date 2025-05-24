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
    const { email, name, password, role } = await req.json();

    // Validate input
    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "Missing required fields: email, name, and password are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate role
    const validRoles = ["USER", "ADMIN"];
    const userRole = role && validRoles.includes(role.toUpperCase()) ? role.toUpperCase() : "USER";

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409, headers: corsHeaders }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: userRole,
      },
    });

    return NextResponse.json(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("User creation error:", error);
    return NextResponse.json(
      { error: "User creation failed", details: error.message },
      { status: 400, headers: corsHeaders }
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
