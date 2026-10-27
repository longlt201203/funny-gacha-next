import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extensionFromMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") {
    return ".jpg";
  }
  if (mimeType === "image/png") {
    return ".png";
  }
  if (mimeType === "image/webp") {
    return ".webp";
  }
  if (mimeType === "image/gif") {
    return ".gif";
  }
  return "";
}

function buildPublicUrl(request: Request, relativePath: string): string {
  const requestUrl = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");

  if (forwardedHost) {
    const protocol = forwardedProto ?? requestUrl.protocol.replace(":", "");
    return `${protocol}://${forwardedHost}${relativePath}`;
  }

  return new URL(relativePath, requestUrl.origin).toString();
}

function pickFileEntry(formData: FormData): File | null {
  const preferred = formData.get("file");
  if (preferred instanceof File) {
    return preferred;
  }

  for (const value of formData.values()) {
    if (value instanceof File) {
      return value;
    }
  }

  return null;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const fileEntry = pickFileEntry(formData);

  if (!fileEntry) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(fileEntry.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Use JPG, PNG, WEBP, or GIF." },
      { status: 400 },
    );
  }

  if (fileEntry.size === 0) {
    return NextResponse.json({ error: "File cannot be empty" }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const extension = extensionFromMimeType(fileEntry.type);
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const destinationPath = path.join(uploadsDir, fileName);

  const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
  await writeFile(destinationPath, fileBuffer);

  const relativePath = `/uploads/${fileName}`;
  return NextResponse.json(
    {
      url: relativePath,
      publicUrl: buildPublicUrl(request, relativePath),
      fileName,
    },
    { status: 201 },
  );
}
