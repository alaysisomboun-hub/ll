import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'local-uploads-plugin',
        configureServer(server) {
          // Serve static uploads
          server.middlewares.use('/uploads', (req, res, next) => {
            const cleanUrl = (req.url || '').split('?')[0];
            const filePath = path.join(process.cwd(), 'public', 'uploads', cleanUrl);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              const ext = path.extname(filePath).toLowerCase();
              const mimeTypes: Record<string, string> = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.webp': 'image/webp',
                '.gif': 'image/gif',
                '.txt': 'text/plain',
              };
              res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Cache-Control', 'public, max-age=86400');
              return fs.createReadStream(filePath).pipe(res);
            }
            res.statusCode = 404;
            return res.end('Not Found');
          });

          // Upload API endpoint
          server.middlewares.use('/api/upload', (req, res, next) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              return res.end('Method Not Allowed');
            }

            const chunks: Buffer[] = [];
            req.on('data', (chunk) => {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            });
            req.on('end', () => {
              try {
                const rawBody = Buffer.concat(chunks).toString('utf-8');
                const data = JSON.parse(rawBody);
                const { filename, mimeType, base64 } = data;
                if (!filename || !base64) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ error: 'Missing filename or base64 data' }));
                }

                const cleanBase64 = base64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
                const buffer = Buffer.from(cleanBase64, 'base64');

                if (buffer.length > 5 * 1024 * 1024) {
                  res.statusCode = 413;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ error: 'File size exceeds 5MB limit' }));
                }

                const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
                if (!fs.existsSync(uploadsDir)) {
                  fs.mkdirSync(uploadsDir, { recursive: true });
                }

                const safeName = `prod_${Date.now()}_${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                const targetPath = path.join(uploadsDir, safeName);
                fs.writeFileSync(targetPath, buffer);

                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                return res.end(
                  JSON.stringify({
                    success: true,
                    url: `/uploads/${safeName}`,
                    filename: safeName,
                    size: buffer.length,
                  })
                );
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: err.message || 'Server error saving file' }));
              }
            });
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
