import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

interface PunchEvent {
  id: string;
  pin: string;
  timestamp: string;
  deviceIp?: string;
  deviceSn?: string;
  deviceName?: string;
  verifyType?: string;
  punchState?: string; // '0' = CheckIn, '1' = CheckOut, 'auto'
  receivedAt: string;
}

const app = express();
const PORT = 3000;

// Body parsers for JSON, URL-encoded, and plain text (ADMS sends tab-separated text/plain)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: ['text/plain', 'application/xml', 'text/xml'], limit: '10mb' }));

// Enable CORS for local LAN requests & proxies
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// SSE (Server-Sent Events) clients store
type SSEClient = {
  id: number;
  res: Response;
};
let sseClients: SSEClient[] = [];
let nextClientId = 1;

// Recent punches in-memory buffer (last 50)
const recentPunches: PunchEvent[] = [];

// Broadcast helper
function broadcastPunch(punch: PunchEvent) {
  recentPunches.unshift(punch);
  if (recentPunches.length > 50) {
    recentPunches.pop();
  }

  const payload = `data: ${JSON.stringify(punch)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.res.write(payload);
    } catch (e) {
      // client disconnected
    }
  });
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// 1. Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'SIAP-TEX Attendance & Fingerprint Gateway',
    timestamp: new Date().toISOString(),
    activeSseClients: sseClients.length,
    recentPunchesCount: recentPunches.length
  });
});

// 2. SSE Stream for Realtime Live Punch in Browser
app.get('/api/fingerprint/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = nextClientId++;
  const newClient: SSEClient = { id: clientId, res };
  sseClients.push(newClient);

  // Send initial handshake & recent logs
  const initData = {
    type: 'CONNECTED',
    clientId,
    recentPunches: recentPunches.slice(0, 10),
    timestamp: new Date().toISOString()
  };
  res.write(`data: ${JSON.stringify(initData)}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// 3. Universal Webhook Push Endpoint (REST JSON)
// Digunakan oleh script LAN Agent (Node.js/Python) atau Webhook Mesin
app.post('/api/fingerprint/push', (req: Request, res: Response) => {
  const body = req.body;
  const pin = String(body.pin || body.userPin || body.userId || body.enrollNumber || body.ID || '').trim();
  const timestamp = body.timestamp || body.time || body.dateTime || new Date().toISOString().replace('T', ' ').slice(0, 19);
  const deviceIp = body.deviceIp || body.ip || req.ip || 'LAN Machine';
  const deviceSn = body.deviceSn || body.sn || 'SN-DEFAULT';
  const deviceName = body.deviceName || 'Mesin Fingerprint LAN';
  const punchState = body.punchState || body.status || 'auto';

  if (!pin) {
    return res.status(400).json({ error: 'PIN / userPin is required' });
  }

  const punch: PunchEvent = {
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

  console.log(`[FINGERPRINT PUSH RECEIVED] PIN: ${pin} | Time: ${timestamp} | IP: ${deviceIp}`);

  res.json({
    status: 'success',
    message: 'Punch log received and broadcasted to clients',
    punch
  });
});

// 4. Batch LAN Sync Endpoint (Menerima sekumpulan log sekaligus dari LAN poller)
app.post('/api/fingerprint/lan-sync', (req: Request, res: Response) => {
  const body = req.body;
  const logs = Array.isArray(body.logs) ? body.logs : (Array.isArray(body) ? body : []);

  const processed: PunchEvent[] = [];
  logs.forEach((item: any) => {
    const pin = String(item.pin || item.userPin || item.userId || item.enrollNumber || '').trim();
    if (pin) {
      const punch: PunchEvent = {
        id: `punch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        pin,
        timestamp: item.timestamp || item.time || new Date().toISOString().replace('T', ' ').slice(0, 19),
        deviceIp: item.deviceIp || req.ip,
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

  res.json({
    status: 'success',
    receivedCount: logs.length,
    processedCount: processed.length,
    processed
  });
});

// 5. ZKTeco / Solution ADMS Cloud Server Protocol Emulation
// Mesin fingerprint dengan fitur Cloud Server / ADMS mengirim request ke /iclock/cdata
app.get('/iclock/cdata', (req: Request, res: Response) => {
  const sn = req.query.SN || req.query.sn || 'UNKNOWN_SN';
  console.log(`[ADMS GET HANDSHAKE] Device SN: ${sn}`);
  
  // Respon standar ZKTeco ADMS handshake
  res.setHeader('Content-Type', 'text/plain');
  res.send(`GET OPTION FROM: ${sn}\nStamp=9999\nOpStamp=9999\nErrorDelay=30\nDelay=10\nTransTimes=00:00;14:00\nTransInterval=1\nTransFlag=1111111111\nRealtime=1\nEncrypt=0\n`);
});

app.post('/iclock/cdata', (req: Request, res: Response) => {
  const sn = (req.query.SN || req.query.sn || 'UNKNOWN_SN') as string;
  const table = (req.query.table || req.query.TABLE || 'ATTLOG') as string;
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  console.log(`[ADMS POST LOGS] Device SN: ${sn} | Table: ${table}`);

  let countPunches = 0;

  // Format ATTLOG dari ADMS biasanya baris per baris berupa: PIN\tYYYY-MM-DD HH:mm:ss\tStatus\tVerify
  if (typeof req.body === 'string') {
    const lines = req.body.split('\n');
    lines.forEach(line => {
      const parts = line.trim().split(/\t|\s{2,}/);
      if (parts.length >= 2) {
        const pin = parts[0].trim();
        const timestamp = parts[1].trim();
        const punchState = parts[2] ? parts[2].trim() : 'auto';

        if (pin && timestamp && timestamp.length >= 10) {
          countPunches++;
          const punch: PunchEvent = {
            id: `adms-${Date.now()}-${countPunches}`,
            pin,
            timestamp,
            deviceIp: req.ip,
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
  }

  // Respon balik standar ADMS agar mesin menganggap log sukses diterima
  res.setHeader('Content-Type', 'text/plain');
  res.send(`OK: ${countPunches || 1}\n`);
});

app.get('/iclock/getrequest', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('OK\n');
});

app.post('/iclock/devicecmd', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('OK\n');
});

// 6. Test simulation endpoint for instant verification
app.post('/api/fingerprint/simulate', (req: Request, res: Response) => {
  const { pin, name, time } = req.body;
  const now = new Date();
  const timeStr = time || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const punch: PunchEvent = {
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

  res.json({
    status: 'success',
    message: `Simulasi finger scan berhasil untuk PIN: ${punch.pin}`,
    punch
  });
});

// -------------------------------------------------------------
// VITE / STATIC CLIENT APP SERVING
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 SIAP-TEX Server & Fingerprint Gateway running!`);
    console.log(`🌐 Port: ${PORT} (0.0.0.0:${PORT})`);
    console.log(`📡 Live ADMS Endpoint: /iclock/cdata`);
    console.log(`🔌 Live Webhook Push:   /api/fingerprint/push`);
    console.log(`⚡ Realtime SSE Stream: /api/fingerprint/stream`);
    console.log(`====================================================`);
  });
}

startServer();
