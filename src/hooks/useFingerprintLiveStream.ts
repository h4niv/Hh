import { useState, useEffect, useRef, useCallback } from 'react';
import { Employee, AttendanceRecord, OfficeConfig } from '../types';
import { PunchEvent, processIncomingPunchLog, AutoProcessResult } from '../services/fingerprintAutoReceiver';

interface UseFingerprintLiveStreamProps {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  officeConfig: OfficeConfig;
  onRecordUpdated: (record: AttendanceRecord) => void;
  onShowToast: (text: string, type: 'success' | 'info' | 'error') => void;
}

export function useFingerprintLiveStream({
  employees,
  attendanceRecords,
  officeConfig,
  onRecordUpdated,
  onShowToast
}: UseFingerprintLiveStreamProps) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastPunch, setLastPunch] = useState<PunchEvent | null>(null);
  const [punchFeed, setPunchFeed] = useState<AutoProcessResult[]>([]);
  const [activeNotification, setActiveNotification] = useState<AutoProcessResult | null>(null);
  const [autoReceiverEnabled, setAutoReceiverEnabled] = useState<boolean>(true);

  // Keep latest refs to avoid stale closures in SSE callback
  const employeesRef = useRef(employees);
  employeesRef.current = employees;

  const recordsRef = useRef(attendanceRecords);
  recordsRef.current = attendanceRecords;

  const configRef = useRef(officeConfig);
  configRef.current = officeConfig;

  const onRecordUpdatedRef = useRef(onRecordUpdated);
  onRecordUpdatedRef.current = onRecordUpdated;

  const onShowToastRef = useRef(onShowToast);
  onShowToastRef.current = onShowToast;

  const autoReceiverEnabledRef = useRef(autoReceiverEnabled);
  autoReceiverEnabledRef.current = autoReceiverEnabled;

  const handleIncomingPunch = useCallback((punch: PunchEvent) => {
    if (!autoReceiverEnabledRef.current) return;

    setLastPunch(punch);

    const result = processIncomingPunchLog(
      punch,
      employeesRef.current,
      recordsRef.current,
      configRef.current
    );

    setPunchFeed((prev) => [result, ...prev.slice(0, 30)]);
    setActiveNotification(result);

    // Auto dismiss active notification banner after 6 seconds
    setTimeout(() => {
      setActiveNotification((curr) => (curr?.punch.id === punch.id ? null : curr));
    }, 6000);

    if (result.success && result.record) {
      onRecordUpdatedRef.current(result.record);
      onShowToastRef.current(result.message, result.record.status === 'Terlambat' ? 'error' : 'success');
    } else if (result.type === 'unmapped') {
      onShowToastRef.current(result.message, 'error');
    } else {
      onShowToastRef.current(result.message, 'info');
    }
  }, []);

  // Connect SSE stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      try {
        eventSource = new EventSource('/api/fingerprint/stream');

        eventSource.onopen = () => {
          setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'CONNECTED') {
              setIsConnected(true);
            } else if (data.pin) {
              handleIncomingPunch(data as PunchEvent);
            }
          } catch (err) {
            console.error('Error parsing SSE data:', err);
          }
        };

        eventSource.onerror = () => {
          setIsConnected(false);
          eventSource?.close();
          // Auto reconnect after 3 seconds
          reconnectTimeout = setTimeout(connect, 3000);
        };
      } catch (err) {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
    };
  }, [handleIncomingPunch]);

  // Simulate punch helper (calls server endpoint to trigger live broadcast)
  const simulatePunch = async (pin: string, name?: string) => {
    try {
      const res = await fetch('/api/fingerprint/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, name })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      // Fallback local broadcast if offline
      const now = new Date();
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const fallbackPunch: PunchEvent = {
        id: `sim-local-${Date.now()}`,
        pin,
        timestamp: timeStr,
        deviceIp: '192.168.1.201',
        deviceName: 'Mesin Fingerprint LAN (Simulasi)',
        receivedAt: new Date().toISOString()
      };
      handleIncomingPunch(fallbackPunch);
      return { status: 'success', punch: fallbackPunch };
    }
  };

  return {
    isConnected,
    lastPunch,
    punchFeed,
    activeNotification,
    autoReceiverEnabled,
    setAutoReceiverEnabled,
    simulatePunch,
    dismissNotification: () => setActiveNotification(null)
  };
}
