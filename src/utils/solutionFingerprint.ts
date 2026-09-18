// Utility and Integration Helper for Solution Fingerprint Machines (Mesin Absensi Solution via IP)

export interface SolutionMachineConfig {
  ip: string;
  port: number; // 80 (HTTP SOAP) or 4370 (ZK TCP/UDP)
  commKey: string; // Default '0'
  protocol: 'soap_http' | 'tcp_4370' | 'adms_push';
  model: string;
  name: string;
  timeoutSeconds: number;
}

export interface SolutionLogItem {
  pin: string; // NIK / User PIN di mesin
  dateTime: string; // YYYY-MM-DD HH:mm:ss
  verified: number; // 1: Fingerprint, 2: Password, 15: Face, 3: RFID
  status: number; // 0: Check-In, 1: Check-Out, 2: Break-Out, 3: Break-In, 4: OT-In, 5: OT-Out
  workCode: number;
}

export interface SolutionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  deviceInfo?: {
    firmware?: string;
    serialNumber?: string;
    deviceModel?: string;
    userCount?: number;
    logCount?: number;
    macAddress?: string;
  };
  diagnostics?: {
    ipValid: boolean;
    isPrivateLan: boolean;
    portReachable: boolean;
    soapSupported: boolean;
  };
}

// Generate SOAP XML for Solution Machine GetAttLog
export function generateSolutionSoapGetAttLog(commKey: string = '0', pin: string = 'All'): string {
  return [
    '<GetAttLog>',
    `  <ArgComKey xsi:type="xsd:integer">${commKey}</ArgComKey>`,
    '  <Arg>',
    `    <PIN xsi:type="xsd:integer">${pin}</PIN>`,
    '  </Arg>',
    '</GetAttLog>',
  ].join('\n');
}

// Generate SOAP XML for Solution Machine GetUserInfo
export function generateSolutionSoapGetUserInfo(commKey: string = '0', pin: string = 'All'): string {
  return [
    '<GetUserInfo>',
    `  <ArgComKey xsi:type="xsd:integer">${commKey}</ArgComKey>`,
    '  <Arg>',
    `    <PIN xsi:type="xsd:integer">${pin}</PIN>`,
    '  </Arg>',
    '</GetUserInfo>',
  ].join('\n');
}

// Generate SOAP XML for Solution Machine SetUserInfo (Upload User Name / PIN)
export function generateSolutionSoapSetUserInfo(commKey: string = '0', pin: string, name: string, password: string = '', privilege: number = 0): string {
  return [
    '<SetUserInfo>',
    `  <ArgComKey xsi:type="xsd:integer">${commKey}</ArgComKey>`,
    '  <Arg>',
    `    <PIN xsi:type="xsd:integer">${pin}</PIN>`,
    `    <Name xsi:type="xsd:string">${name}</Name>`,
    `    <Password xsi:type="xsd:string">${password}</Password>`,
    `    <Privilege xsi:type="xsd:integer">${privilege}</Privilege>`,
    '    <Card xsi:type="xsd:string">0</Card>',
    '    <Group xsi:type="xsd:integer">1</Group>',
    '  </Arg>',
    '</SetUserInfo>',
  ].join('\n');
}

// Generate SOAP XML for Solution Machine Sync Device Time
export function generateSolutionSoapSetDate(commKey: string = '0', dateObj: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
  
  return [
    '<SetDate>',
    `  <ArgComKey xsi:type="xsd:integer">${commKey}</ArgComKey>`,
    '  <Arg>',
    `    <Date xsi:type="xsd:string">${dateStr}</Date>`,
    '  </Arg>',
    '</SetDate>',
  ].join('\n');
}

// Parse Solution SOAP XML GetAttLog Response
export function parseSolutionSoapLogResponse(xmlText: string): SolutionLogItem[] {
  const results: SolutionLogItem[] = [];
  
  // Standard Solution SOAP response contains <Row><PIN>...</PIN><DateTime>...</DateTime><Verified>...</Verified><Status>...</Status><WorkCode>...</WorkCode></Row>
  const rowRegex = /<Row>(.*?)<\/Row>/gs;
  let match;
  
  while ((match = rowRegex.exec(xmlText)) !== null) {
    const rowContent = match[1];
    
    const pinMatch = /<PIN>(.*?)<\/PIN>/i.exec(rowContent);
    const dateMatch = /<DateTime>(.*?)<\/DateTime>/i.exec(rowContent);
    const verifiedMatch = /<Verified>(.*?)<\/Verified>/i.exec(rowContent);
    const statusMatch = /<Status>(.*?)<\/Status>/i.exec(rowContent);
    const workCodeMatch = /<WorkCode>(.*?)<\/WorkCode>/i.exec(rowContent);
    
    if (pinMatch && dateMatch) {
      results.push({
        pin: pinMatch[1].trim(),
        dateTime: dateMatch[1].trim(),
        verified: verifiedMatch ? parseInt(verifiedMatch[1], 10) : 1,
        status: statusMatch ? parseInt(statusMatch[1], 10) : 0,
        workCode: workCodeMatch ? parseInt(workCodeMatch[1], 10) : 0,
      });
    }
  }
  
  return results;
}

// Generate Complete PHP Script for Solution Machine Pull (Standard Indonesia Solution Technical Implementation)
export function generateSolutionPhpScript(config: SolutionMachineConfig, serverUrl: string, apiKey: string): string {
  return `<?php
/**
 * ==============================================================================
 * SCRIPT PENARIKAN LOG MESIN FINGERPRINT SOLUTION (SOAP IP PORT 80 / 4370)
 * ==============================================================================
 * Kompatibel dengan semua tipe Mesin Solution:
 * Solution X100-C, Solution X105, Solution X302, Solution X304, Solution X601,
 * Solution X900, Solution P207, P208, FingerSpot Solution Series.
 *
 * Cara menjalankan:
 * 1. Simpan file ini di server lokal / XAMPP kantor (cth: C:\\xampp\\htdocs\\tarik_solution.php)
 * 2. Jalankan via browser: http://localhost/tarik_solution.php
 *    atau via Task Scheduler / Cron Job Windows: C:\\xampp\\php\\php.exe -f C:\\xampp\\htdocs\\tarik_solution.php
 */

header('Content-Type: text/html; charset=utf-8');

// 1. KONFIGURASI IP MESIN SOLUTION
$IP_MESIN       = "${config.ip}";         // IP Address Mesin Solution Anda di LAN
$PORT_MESIN     = "${config.port}";       // Default: 80 (HTTP SOAP) atau 4370
$COMM_KEY       = "${config.commKey}";    // Default: 0 (Communication Key)
$NAMA_MESIN     = "${config.name}";       // Nama / Lokasi Mesin

// 2. KONFIGURASI SERVER CLOUD ABSENSIPRO
$SERVER_URL     = "${serverUrl.replace(/\/$/, '')}/api/fingerprint/sync";
$API_KEY        = "${apiKey}";

echo "<h2>🚀 Memulai Tarik Log Mesin Solution ({$NAMA_MESIN} - {$IP_MESIN}:{$PORT_MESIN})...</h2><hr/>";

// Cek koneksi socket dasar ke IP mesin
$socket = @fsockopen($IP_MESIN, $PORT_MESIN, $errno, $errstr, 5);
if (!$socket) {
    die("<p style='color:red;'><b>❌ Gagal terhubung ke Mesin Solution ({$IP_MESIN}:{$PORT_MESIN})</b><br/>"
      . "Error: $errstr ($errno)<br/>"
      . "Pastikan komputer dan mesin Solution berada dalam satu jaringan router / LAN dan kabel LAN terpasang dengan baik.</p>");
}
fclose($socket);
echo "<p style='color:green;'><b>✓ Socket IP Mesin Solution Berhasil Terhubung!</b></p>";

// 3. Request SOAP XML GetAttLog ke Mesin Solution
$soapRequest = "<GetAttLog>"
             . "<ArgComKey xsi:type=\"xsd:integer\">{$COMM_KEY}</ArgComKey>"
             . "<Arg><PIN xsi:type=\"xsd:integer\">All</PIN></Arg>"
             . "</GetAttLog>";

$header = "POST /iWsService HTTP/1.0\\r\\n"
        . "Content-Type: text/xml\\r\\n"
        . "Content-Length: " . strlen($soapRequest) . "\\r\\n\\r\\n"
        . $soapRequest;

$fp = @fsockopen($IP_MESIN, $PORT_MESIN, $errno, $errstr, 15);
if (!$fp) {
    die("<p style='color:red;'>❌ Gagal membuka koneksi HTTP SOAP ke mesin.</p>");
}

fputs($fp, $header);
$response = "";
while (!feof($fp)) {
    $response .= fgets($fp, 1024);
}
fclose($fp);

// 4. Parsing XML Data Log
preg_match_all("/<Row>(.*?)<\\/Row>/s", $response, $rows);
$totalLog = count($rows[1]);

echo "<p>Total data log terbaca dari mesin: <b>{$totalLog} log</b></p>";

if ($totalLog === 0) {
    echo "<p style='color:orange;'>Tidak ada log presensi baru di dalam memori mesin Solution.</p>";
    exit;
}

$logsToSend = [];
foreach ($rows[1] as $row) {
    preg_match("/<PIN>(.*?)<\\/PIN>/", $row, $pin);
    preg_match("/<DateTime>(.*?)<\\/DateTime>/", $row, $dt);
    preg_match("/<Verified>(.*?)<\\/Verified>/", $row, $ver);
    preg_match("/<Status>(.*?)<\\/Status>/", $row, $st);

    if (!empty($pin[1]) && !empty($dt[1])) {
        $punch = isset($st[1]) && intval($st[1]) === 1 ? 'CheckOut' : 'CheckIn';
        $method = isset($ver[1]) && intval($ver[1]) === 15 ? 'Face' : 'Fingerprint';
        
        $logsToSend[] = [
            'pin'          => trim($pin[1]),
            'timestamp'    => trim($dt[1]),
            'punchType'    => $punch,
            'verifyMethod' => $method
        ];
    }
}

// 5. Kirim data log ke Cloud Server AbsensiPro
$payload = json_encode([
    'apiKey'     => $API_KEY,
    'deviceIp'   => $IP_MESIN,
    'deviceName' => $NAMA_MESIN,
    'timestamp'  => date('Y-m-d H:i:s'),
    'logs'       => $logsToSend
]);

$ch = curl_init($SERVER_URL);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Content-Length: ' . strlen($payload),
    'Authorization: Bearer ' . $API_KEY
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);

$serverResp = curl_exec($ch);
$httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr    = curl_error($ch);
curl_close($ch);

if ($httpCode >= 200 && $httpCode < 300) {
    echo "<div style='padding:12px;background:#e6f9e6;border:1px solid #52c41a;border-radius:8px;color:#135200;'>"
       . "<h3>✅ BERHASIL SINKRONISASI!</h3>"
       . "<p>Sebanyak <b>" . count($logsToSend) . " log presensi</b> dari Mesin Solution ({$IP_MESIN}) berhasil dikirim ke Cloud Server AbsensiPro.</p>"
       . "<p>Respon Server: {$serverResp}</p>"
       . "</div>";
} else {
    echo "<div style='padding:12px;background:#fff1f0;border:1px solid #ffa39e;border-radius:8px;color:#a8071a;'>"
       . "<h3>⚠️ Respon Server Cloud: {$httpCode}</h3>"
       . "<p>Respon: {$serverResp}</p>"
       . ($curlErr ? "<p>cURL Error: {$curlErr}</p>" : "")
       . "</div>";
}
?>
`;
}

// Generate Complete Node.js Script for Solution Machine (Supports SOAP Port 80 & Port 4370)
export function generateSolutionNodeScript(config: SolutionMachineConfig, serverUrl: string, apiKey: string): string {
  return `/**
 * ==============================================================================
 * ABSENSIPRO - SOLUTION FINGERPRINT SYNC AGENT (NODE.JS)
 * ==============================================================================
 * Khusus untuk Mesin Absensi Merk SOLUTION (X100-C, X105, X302, X304, X601, X900, dll)
 * Menggunakan protokol SOAP XML via HTTP Port 80 atau ZKTeco Port 4370.
 */

const http = require('http');
const https = require('https');
const net = require('net');
const { URL } = require('url');

const CONFIG = {
  DEVICE_IP: '${config.ip}',
  DEVICE_PORT: ${config.port},
  COMM_KEY: '${config.commKey}',
  DEVICE_NAME: '${config.name}',
  SERVER_URL: '${serverUrl.replace(/\/$/, '')}/api/fingerprint/sync',
  API_KEY: '${apiKey}',
  POLL_INTERVAL_SECONDS: ${config.timeoutSeconds || 30},
};

console.log('====================================================');
console.log('🚀 AbsensiPro - Solution Machine Sync Agent');
console.log('Target Mesin Solution : ' + CONFIG.DEVICE_NAME + ' (' + CONFIG.DEVICE_IP + ':' + CONFIG.DEVICE_PORT + ')');
console.log('Cloud Server Target   : ' + CONFIG.SERVER_URL);
console.log('Interval Polling      : ' + CONFIG.POLL_INTERVAL_SECONDS + ' detik');
console.log('====================================================\\n');

let lastSyncTimestamp = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

function fetchLogsViaSoap() {
  return new Promise((resolve, reject) => {
    const soapBody = 
      '<GetAttLog>' +
      '  <ArgComKey xsi:type="xsd:integer">' + CONFIG.COMM_KEY + '</ArgComKey>' +
      '  <Arg><PIN xsi:type="xsd:integer">All</PIN></Arg>' +
      '</GetAttLog>';

    const reqData = 
      'POST /iWsService HTTP/1.0\\r\\n' +
      'Content-Type: text/xml\\r\\n' +
      'Content-Length: ' + Buffer.byteLength(soapBody) + '\\r\\n\\r\\n' +
      soapBody;

    const socket = new net.Socket();
    let responseData = '';

    socket.setTimeout(8000);

    socket.connect(CONFIG.DEVICE_PORT, CONFIG.DEVICE_IP, () => {
      socket.write(reqData);
    });

    socket.on('data', (chunk) => {
      responseData += chunk.toString();
    });

    socket.on('end', () => {
      resolve(parseSoapLogs(responseData));
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Koneksi ke IP Mesin Solution (' + CONFIG.DEVICE_IP + ') timeout (8s).'));
    });

    socket.on('error', (err) => {
      reject(err);
    });
  });
}

function parseSoapLogs(rawXml) {
  const logs = [];
  const rowRegex = /<Row>(.*?)<\\/Row>/gs;
  let match;

  while ((match = rowRegex.exec(rawXml)) !== null) {
    const row = match[1];
    const pin = (row.match(/<PIN>(.*?)<\\/PIN>/i) || [])[1];
    const dt = (row.match(/<DateTime>(.*?)<\\/DateTime>/i) || [])[1];
    const ver = (row.match(/<Verified>(.*?)<\\/Verified>/i) || [])[1];
    const st = (row.match(/<Status>(.*?)<\\/Status>/i) || [])[1];

    if (pin && dt) {
      logs.push({
        pin: pin.trim(),
        timestamp: dt.trim(),
        punchType: st === '1' ? 'CheckOut' : 'CheckIn',
        verifyMethod: ver === '15' ? 'Face' : 'Fingerprint',
      });
    }
  }
  return logs;
}

async function sendLogsToCloud(logs) {
  if (!logs || logs.length === 0) return;

  const payload = JSON.stringify({
    apiKey: CONFIG.API_KEY,
    deviceIp: CONFIG.DEVICE_IP,
    deviceName: CONFIG.DEVICE_NAME,
    timestamp: new Date().toISOString(),
    logs: logs,
  });

  const parsedUrl = new URL(CONFIG.SERVER_URL);
  const client = parsedUrl.protocol === 'https:' ? https : http;

  return new Promise((resolve) => {
    const req = client.request(parsedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': 'Bearer ' + CONFIG.API_KEY,
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ [OK] Berhasil mengirim ' + logs.length + ' log ke AbsensiPro Cloud (' + res.statusCode + ')');
          resolve(true);
        } else {
          console.warn('⚠️ [WARN] Cloud Server merespon status ' + res.statusCode + ': ' + data);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ [ERROR] Gagal kirim ke Cloud Server:', err.message);
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

async function runCycle() {
  try {
    process.stdout.write('[' + new Date().toLocaleTimeString('id-ID') + '] Menghubungkan ke Mesin Solution ' + CONFIG.DEVICE_IP + '...');
    const allLogs = await fetchLogsViaSoap();
    console.log(' Terhubung! ✓ (' + allLogs.length + ' log di mesin)');

    const newLogs = allLogs.filter(l => new Date(l.timestamp).toISOString() > lastSyncTimestamp);

    if (newLogs.length > 0) {
      console.log('⚡ Menemukan ' + newLogs.length + ' log baru dari mesin Solution! Mengirimkan ke server...');
      await sendLogsToCloud(newLogs);
      lastSyncTimestamp = newLogs.reduce((max, l) => {
        const t = new Date(l.timestamp).toISOString();
        return t > max ? t : max;
      }, lastSyncTimestamp);
    } else {
      console.log('   Tidak ada tap sidik jari baru.');
    }
  } catch (err) {
    console.error('❌ Gagal membaca mesin Solution:', err.message);
  }
}

// Mulai loop polling
runCycle();
setInterval(runCycle, CONFIG.POLL_INTERVAL_SECONDS * 1000);
`;
}

// Generate Windows Batch File for 1-Click Execution
export function generateSolutionBatchFile(): string {
  return `@echo off
title AbsensiPro - Solution Fingerprint Sync
color 0B
echo ===================================================================
echo     ABSENSIPRO - SINKRONISASI MESIN FINGERPRINT MERK SOLUTION
echo ===================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js belum terinstal di komputer kantor ini!
    echo Silakan download dan instal Node.js dari: https://nodejs.org/
    echo.
    pause
    exit /b
)

echo Menjalankan agent sinkronisasi mesin Solution...
echo Tekan Ctrl+C untuk berhenti.
echo.

:LOOP
node solution_sync.js
echo.
echo [INFO] Script terhenti. Mengulang kembali dalam 5 detik...
timeout /t 5 >nul
goto LOOP
`;
}
