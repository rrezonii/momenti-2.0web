import { NextResponse } from "next/server";
import { kflSessionCookie } from "@/lib/kfl/auth";
import { isSameOriginRequest } from "@/lib/kfl/origin";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Kërkesë e pavlefshme" }, { status: 403 });
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(kflSessionCookie, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/kycu",
    maxAge: 0,
  });
  return response;
}
