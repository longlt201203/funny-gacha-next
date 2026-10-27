import { NextRequest, NextResponse } from "next/server";

const ALLOWED_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD";
const DEFAULT_ALLOWED_HEADERS = "Content-Type, Authorization";

function resolveAllowOrigin(request: NextRequest): string {
  const configured = process.env.CORS_ORIGIN?.trim();
  const requestOrigin = request.headers.get("origin");

  if (!configured || configured === "*") {
    return requestOrigin ?? "*";
  }

  if (!requestOrigin) {
    return configured.split(",")[0]?.trim() || "*";
  }

  const allowedOrigins = configured
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins[0] ?? "*";
}

function addCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const requestHeaders = request.headers.get("access-control-request-headers");
  response.headers.set("Access-Control-Allow-Origin", resolveAllowOrigin(request));
  response.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  response.headers.set("Access-Control-Allow-Headers", requestHeaders || DEFAULT_ALLOWED_HEADERS);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Max-Age", "86400");
  response.headers.set("Vary", "Origin");
  return response;
}

export function proxy(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return addCorsHeaders(new NextResponse(null, { status: 204 }), request);
  }

  return addCorsHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: "/api/:path*",
};
