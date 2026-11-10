import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for JSON bodies up to 15MB
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

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
    }
  }));

  // API upload route
  app.post('/api/upload', (req, res) => {
    try {
      const { filename, mimeType, base64 } = req.body;

      if (!base64 || !filename) {
        return res.status(400).json({ error: 'Missing file data or filename' });
      }

      // Validate MIME type
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];
      const effectiveMime = (mimeType || '').toLowerCase();
      if (effectiveMime && !allowedMimes.includes(effectiveMime)) {
        return res.status(415).json({ error: 'Unsupported file type. Only JPG, PNG, WebP, GIF allowed.' });
      }

      // Clean base64 string
      const cleanBase64 = base64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');

      // Max size check: 5MB
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(413).json({ error: 'File size exceeds 5MB limit' });
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
      return res.status(500).json({ error: err.message || 'Internal server error while saving file' });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mount Vite dev server middlewares
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 POS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
