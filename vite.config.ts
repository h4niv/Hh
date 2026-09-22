import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// In-memory SSE clients for real-time fingerprint push
let sseClients: any[] = [];
let nextClientId = 1;
const recentPunches: any[] = [];

function broadcastPunch(punch: any) {
  recentPunches.unshift(punch);
  if (recentPunches.length > 50) recentPunches.pop();
  const payload = `data: ${JSON.stringify(punch)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(payload);
    } catch (e) {
      // client disconnected
    }
  });
}

function fingerprintGatewayPlugin(): Plugin {
  return {
    name: 'fingerprint-gateway-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';

        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        // 1. Health check
        if (url === '/api/health') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            status: 'ok',
            service: 'SIAP-TEX Attendance & Fingerprint Gateway',
            timestamp: new Date().toISOString(),
            activeSseClients: sseClients.length,
            recentPunchesCount: recentPunches.length
          }));
          return;
        }

        // 2. SSE Stream
        if (url.startsWith('/api/fingerprint/stream')) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('Access-Control-Allow-Origin', '*');

          const clientId = nextClientId++;
          const client = { id: clientId, res };
          sseClients.push(client);

          const initData = {
            type: 'CONNECTED',
            clientId,
            recentPunches: recentPunches.slice(0, 10),
            timestamp: new Date().toISOString()
          };
          res.write(`data: ${JSON.stringify(initData)}\n\n`);

          req.on('close', () => {
            sseClients = sseClients.filter((c) => c.id !== clientId);
          });
          return;
        }

        // Helper to read body buffer
        const readBody = (callback: (bodyStr: string) => void) => {
          let data = '';
          req.on('data', (chunk) => {
            data += chunk;
          });
          req.on('end', () => {
            callback(data);
          });
        };

        // 3. Webhook Push
        if (url.startsWith('/api/fingerprint/push') && req.method === 'POST') {
          readBody((raw) => {
            let body: any = {};
            try {
              body = JSON.parse(raw);
            } catch (e) {
              body = {};
            }

            const pin = String(body.pin || body.userPin || body.userId || body.enrollNumber || body.ID || '').trim();
            const timestamp = body.timestamp || body.time || body.dateTime || new Date().toISOString().replace('T', ' ').slice(0, 19);
            const deviceIp = body.deviceIp || body.ip || req.socket.remoteAddress || 'LAN Machine';
            const deviceSn = body.deviceSn || body.sn || 'SN-DEFAULT';
            const deviceName = body.deviceName || 'Mesin Fingerprint LAN';
            const punchState = body.punchState || body.status || 'auto';

            if (!pin) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'PIN / userPin is required' }));
              return;
            }

            const punch = {
              id: `punch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              pin,
              timestamp,
              deviceIp,
              deviceSn,
              deviceName,
              punchState,
              verifyType: body.verifyType || 'Fingerprint',
              receivedAt: new Date().toISOString()
            };

            broadcastPunch(punch);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              status: 'success',
              message: 'Punch log received and broadcasted to clients',
              punch
            }));
          });
          return;
        }

        // 4. Batch LAN Sync
        if (url.startsWith('/api/fingerprint/lan-sync') && req.method === 'POST') {
          readBody((raw) => {
            let body: any = {};
            try {
              body = JSON.parse(raw);
            } catch (e) {
              body = [];
            }
            const logs = Array.isArray(body.logs) ? body.logs : (Array.isArray(body) ? body : []);
            const processed: any[] = [];

            logs.forEach((item: any) => {
              const pin = String(item.pin || item.userPin || item.userId || item.enrollNumber || '').trim();
              if (pin) {
                const punch = {
                  id: `punch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                  pin,
                  timestamp: item.timestamp || item.time || new Date().toISOString().replace('T', ' ').slice(0, 19),
                  deviceIp: item.deviceIp || req.socket.remoteAddress,
                  deviceSn: item.deviceSn || 'SN-LAN',
                  deviceName: item.deviceName || 'Mesin LAN Solution/ZKTeco',
                  punchState: item.punchState || 'auto',
                  verifyType: item.verifyType || 'Fingerprint',
                  receivedAt: new Date().toISOString()
                };
                processed.push(punch);
                broadcastPunch(punch);
              }
            });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              status: 'success',
              receivedCount: logs.length,
              processedCount: processed.length,
              processed
            }));
          });
          return;
        }

        // 5. Test Simulation
        if (url.startsWith('/api/fingerprint/simulate') && req.method === 'POST') {
          readBody((raw) => {
            let body: any = {};
            try {
              body = JSON.parse(raw);
            } catch (e) {
              body = {};
            }
            const { pin, time } = body;
            const now = new Date();
            const timeStr = time || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

            const punch = {
              id: `sim-${Date.now()}`,
              pin: String(pin || '1'),
              timestamp: timeStr,
              deviceIp: '192.168.1.201',
              deviceSn: 'SIMULATOR-001',
              deviceName: 'Mesin Fingerprint LAN (Simulasi)',
              punchState: 'auto',
              verifyType: 'Fingerprint Sensor',
              receivedAt: new Date().toISOString()
            };

            broadcastPunch(punch);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              status: 'success',
              message: `Simulasi finger scan berhasil untuk PIN: ${punch.pin}`,
              punch
            }));
          });
          return;
        }

        // 6. ADMS /iclock/cdata
        if (url.startsWith('/iclock/cdata')) {
          if (req.method === 'GET') {
            const parsedUrl = new URL(url, 'http://localhost');
            const sn = parsedUrl.searchParams.get('SN') || parsedUrl.searchParams.get('sn') || 'UNKNOWN_SN';
            res.setHeader('Content-Type', 'text/plain');
            res.end(`GET OPTION FROM: ${sn}\nStamp=9999\nOpStamp=9999\nErrorDelay=30\nDelay=10\nTransTimes=00:00;14:00\nTransInterval=1\nTransFlag=1111111111\nRealtime=1\nEncrypt=0\n`);
            return;
          }

          if (req.method === 'POST') {
            const parsedUrl = new URL(url, 'http://localhost');
            const sn = parsedUrl.searchParams.get('SN') || parsedUrl.searchParams.get('sn') || 'UNKNOWN_SN';
            readBody((raw) => {
              let countPunches = 0;
              const lines = raw.split('\n');
              lines.forEach((line) => {
                const parts = line.trim().split(/\t|\s{2,}/);
                if (parts.length >= 2) {
                  const pin = parts[0].trim();
                  const timestamp = parts[1].trim();
                  const punchState = parts[2] ? parts[2].trim() : 'auto';

                  if (pin && timestamp && timestamp.length >= 10) {
                    countPunches++;
                    const punch = {
                      id: `adms-${Date.now()}-${countPunches}`,
                      pin,
                      timestamp,
                      deviceIp: req.socket.remoteAddress,
                      deviceSn: sn,
                      deviceName: `Mesin ADMS (SN: ${sn})`,
                      punchState,
                      verifyType: 'ADMS Push',
                      receivedAt: new Date().toISOString()
                    };
                    broadcastPunch(punch);
                  }
                }
              });

              res.setHeader('Content-Type', 'text/plain');
              res.end(`OK: ${countPunches || 1}\n`);
            });
            return;
          }
        }

        if (url.startsWith('/iclock/getrequest') || url.startsWith('/iclock/devicecmd')) {
          res.setHeader('Content-Type', 'text/plain');
          res.end('OK\n');
          return;
        }

        // Pass through to Vite for UI & assets
        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      fingerprintGatewayPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'Sistem Absensi Karyawan',
          short_name: 'AbsensiPro',
          description: 'Aplikasi absensi online karyawan dengan verifikasi selfie, GPS geofencing, cuti & sinkronisasi fingerprint.',
          theme_color: '#4f46e5',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
