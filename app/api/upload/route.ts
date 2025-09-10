import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate size (max 5MB) and content type (PDF/DOC/DOCX)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 413 });
    }

    const allowedTypes = new Set<string>([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    // If the browser provided a type, validate it; otherwise allow and let Blob infer
    if (file.type && !allowedTypes.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
    }

    // Ensure blob token is configured in the environment
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'Blob storage not configured. Missing BLOB_READ_WRITE_TOKEN.' },
        { status: 503 }
      );
    }

    const blob = await put(file.name, file, {
      access: 'public',
      token,
      contentType: file.type || 'application/pdf',
      addRandomSuffix: true,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err: any) {
    const msg = err?.message || 'Upload failed';
    if (process.env.NODE_ENV !== 'production') {
      console.error('UPLOAD_ERROR:', msg);
    }
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
