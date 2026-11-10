import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Global CORS Middleware
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Middleware for JSON bodies up to 25MB
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Ensure public/uploads directory exists
  const uploadsDir = path.resolve(process.cwd(), 'public/uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Serve uploaded images statically
  app.use('/uploads', express.static(uploadsDir, {
    maxAge: '1d',
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }));

  // Ping / diagnostic endpoint
  app.get(['/api/ping', '/api/upload/ping', '/api/health'], (req, res) => {
    res.status(200).json({ status: 'ok', service: 'pos-upload-api', timestamp: new Date().toISOString() });
  });

  // Handler for image upload
  const handleUpload = (req: express.Request, res: express.Response) => {
    try {
      const { filename, mimeType, base64 } = req.body || {};

      if (!base64 || !filename) {
        return res.status(400).json({
          error: 'ไม่พบข้อมูลไฟล์รูปภาพหรือชื่อไฟล์ (Missing base64 or filename)'
        });
      }

      // Validate MIME type
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];
      const effectiveMime = (mimeType || '').toLowerCase();
      if (effectiveMime && !allowedMimes.includes(effectiveMime)) {
        return res.status(415).json({
          error: 'ชนิดไฟล์ไม่ถูกต้อง รองรับเฉพาะ JPG, JPEG, PNG, WebP และ GIF เท่านั้น'
        });
      }

      // Clean base64 string
      const cleanBase64 = base64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');

      // Max size check: 5MB
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(413).json({
          error: `ขนาดไฟล์ (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) เกินขีดจำกัด 5 MB`
        });
      }

      // Generate unique safe file name
      const ext = path.extname(filename) || (effectiveMime.includes('png') ? '.png' : effectiveMime.includes('webp') ? '.webp' : '.jpg');
      const baseName = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const uniqueFilename = `prod_${Date.now()}_${baseName}${ext}`;
      const filePath = path.join(uploadsDir, uniqueFilename);

      fs.writeFileSync(filePath, buffer);

      const fileUrl = `/uploads/${uniqueFilename}`;
      console.log(`[Upload] File saved successfully: ${fileUrl} (${buffer.length} bytes)`);

      return res.status(200).json({
        success: true,
        url: fileUrl,
        filename: uniqueFilename,
        size: buffer.length,
        mimeType: effectiveMime || 'image/jpeg',
      });
    } catch (err: any) {
      console.error('[Upload] Error processing upload:', err);
      return res.status(500).json({
        error: err.message || 'เกิดข้อผิดพลาดในการบันทึกรูปภาพบนเซิร์ฟเวอร์'
      });
    }
  };

  // Register API upload on multiple endpoint patterns to avoid any trailing slash or prefix issues
  app.post('/api/upload', handleUpload);
  app.post('/api/upload/', handleUpload);

  // Mount Vite dev server middlewares or static dist
  const isProduction = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(process.cwd(), 'dist');

  if (isProduction && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 POS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
