import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

export async function POST(req: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { ok: false, error: 'BLOB_NOT_CONFIGURED' },
        { status: 500, headers: cors }
      );
    }

    const form = await req.formData();
    const file = form.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'NO_FILE' },
        { status: 400, headers: cors }
      );
    }

    // Optional validation
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: 'FILE_TOO_LARGE' },
        { status: 413, headers: cors }
      );
    }

    const contentType = (file as any).type || 'application/octet-stream';
    const originalName = (file as any).name || 'upload';
    const filename = `cvs/${Date.now()}-${originalName}`;

    const { url } = await put(filename, file, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    });

    return NextResponse.json(
      { ok: true, url },
      { status: 200, headers: cors }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: 'UPLOAD_FAILED', message: String(err?.message ?? err) },
      { status: 500, headers: cors }
    );
  }
}
