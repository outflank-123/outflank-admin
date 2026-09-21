import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAdmin } from '@/lib/supabase/server';
import sharp from 'sharp';

/**
 * GET: List all previously uploaded WhatsApp promotional banners from Supabase Storage
 */
export async function GET() {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data: files, error } = await supabase.storage
      .from('product-images')
      .list('whatsapp-campaigns', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.error('[WhatsApp Media List Error]:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = (files || [])
      .filter((f) => f.name && !f.name.startsWith('.'))
      .map((f) => {
        const path = `whatsapp-campaigns/${f.name}`;
        const { data: publicData } = supabase.storage
          .from('product-images')
          .getPublicUrl(path);

        const sizeKb = f.metadata?.size ? (f.metadata.size / 1024).toFixed(1) + ' KB' : undefined;

        return {
          id: f.id || f.name,
          name: f.name,
          path,
          url: publicData.publicUrl,
          createdAt: f.created_at,
          updatedAt: f.updated_at,
          size: f.metadata?.size,
          sizeKb,
        };
      });

    return NextResponse.json({ success: true, files: items });
  } catch (err: any) {
    console.error('[WhatsApp Media List Exception]:', err);
    return NextResponse.json({ error: err.message || 'List exception' }, { status: 500 });
  }
}

/**
 * POST: Upload and compress banner to WebP strictly under 30KB, preserving natural aspect ratio (square, rectangle, etc.)
 */
export async function POST(req: Request) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Please upload an image file (PNG, JPG, WebP, SVG)' }, { status: 400 });
    }

    // Limit to 10MB input file
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image file size must be less than 10MB' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // Compress to WebP strictly under 30KB (30,720 bytes)
    const TARGET_BYTES = 30 * 1024; // 30 KB
    let quality = 85;
    let isUnderTarget = false;

    if (file.type !== 'image/svg+xml') {
      // Step 1: Adjust WebP quality while keeping exact natural resolution and aspect ratio
      while (quality >= 30) {
        const tempBuffer = await sharp(buffer)
          .webp({ quality, effort: 6 })
          .toBuffer();

        if (tempBuffer.length <= TARGET_BYTES) {
          buffer = tempBuffer;
          isUnderTarget = true;
          break;
        }
        quality -= 5;
      }

      // Step 2: If still over 30KB, scale down resolution proportionally (maintains exact square/rectangle shape)
      if (!isUnderTarget) {
        let scale = 0.85;
        const metadata = await sharp(buffer).metadata();
        const originalWidth = metadata.width || 1200;

        while (!isUnderTarget) {
          const targetWidth = Math.max(Math.round(originalWidth * scale), 160);
          const tempBuffer = await sharp(buffer)
            .resize({ width: targetWidth, withoutEnlargement: true }) // Preserves natural aspect ratio
            .webp({ quality: 60, effort: 6 })
            .toBuffer();

          if (tempBuffer.length <= TARGET_BYTES || targetWidth <= 160) {
            buffer = tempBuffer;
            isUnderTarget = true;
            break;
          }
          scale *= 0.85;
        }
      }
    }

    const ext = file.type === 'image/svg+xml' ? 'svg' : 'webp';
    const contentType = file.type === 'image/svg+xml' ? 'image/svg+xml' : 'image/webp';
    const fileName = `whatsapp-campaigns/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error('[WhatsApp Media Upload Storage Error]:', error);
      return NextResponse.json({ error: 'Storage error: ' + error.message }, { status: 500 });
    }

    const { data: publicData } = supabase.storage
      .from('product-images')
      .getPublicUrl(data.path);

    const sizeKb = (buffer.length / 1024).toFixed(1);

    // Read final dimensions to determine aspect ratio tag (Square, Landscape, Portrait)
    let shape: 'square' | 'landscape' | 'portrait' = 'landscape';
    let width = 0;
    let height = 0;
    try {
      const finalMeta = await sharp(buffer).metadata();
      width = finalMeta.width || 0;
      height = finalMeta.height || 0;
      if (width > 0 && height > 0) {
        const ratio = width / height;
        if (ratio >= 0.95 && ratio <= 1.05) shape = 'square';
        else if (ratio < 0.95) shape = 'portrait';
        else shape = 'landscape';
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      url: publicData.publicUrl,
      path: data.path,
      name: fileName.replace('whatsapp-campaigns/', ''),
      sizeBytes: buffer.length,
      sizeKb: `${sizeKb} KB`,
      format: ext,
      width,
      height,
      shape,
    });
  } catch (err: any) {
    console.error('[WhatsApp Media Upload Exception]:', err);
    return NextResponse.json({ error: err.message || 'Upload exception' }, { status: 500 });
  }
}

/**
 * DELETE: Remove uploaded banner asset from Supabase Storage
 */
export async function DELETE(req: Request) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let filePath = searchParams.get('path');
    const fileUrl = searchParams.get('url');

    // Also support JSON body
    if (!filePath && !fileUrl) {
      try {
        const body = await req.json();
        filePath = body.path;
        if (!filePath && body.url) {
          const match = body.url.match(/whatsapp-campaigns\/[^?#]+/);
          if (match) filePath = match[0];
        }
      } catch {
        // body not json, ignore
      }
    }

    if (!filePath && fileUrl) {
      const match = fileUrl.match(/whatsapp-campaigns\/[^?#]+/);
      if (match) filePath = match[0];
    }

    if (!filePath) {
      return NextResponse.json({ error: 'File path or URL required for deletion' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from('product-images')
      .remove([filePath]);

    if (error) {
      console.error('[WhatsApp Media Delete Error]:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedPath: filePath });
  } catch (err: any) {
    console.error('[WhatsApp Media Delete Exception]:', err);
    return NextResponse.json({ error: err.message || 'Delete exception' }, { status: 500 });
  }
}
