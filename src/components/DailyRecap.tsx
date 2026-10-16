import React, { useState, useMemo } from 'react';
import { AttendanceRecord, Employee } from '../types';
import { getTodayDateString, formatIndonesianDate } from '../utils/geo';
import { Printer } from 'lucide-react';

interface DailyRecapProps {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
}

export default function DailyRecap({ employees, attendanceRecords }: DailyRecapProps) {
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());

  const dailyRecords = useMemo(() => {
    return employees.map(emp => {
      const record = attendanceRecords.find(r => r.employeeId === emp.id && r.date === selectedDate);
      return {
        ...emp,
        record
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, attendanceRecords, selectedDate]);

  const printTable = () => {
    window.print();
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h2 className="text-2xl font-bold text-gray-800">Rekap Harian</h2>
        <div className="flex items-center gap-4">
          <input 
            type="month" 
            value={selectedDate.substring(0, 7)} 
            onChange={(e) => setSelectedDate(`${e.target.value}-01`)}
            className="p-2 border rounded-lg"
          />
          <button 
            onClick={printTable}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Printer size={18} />
            Cetak
          </button>
        </div>
      </div>
      
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold uppercase">REKAP KEHADIRAN GURU / KARYAWAN</h1>
        <h2 className="text-lg font-bold">SMK TEXMACO SEMARANG</h2>
        <p className="text-md font-semibold uppercase">BULAN : {new Date(selectedDate).toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 border border-gray-400 text-center" rowSpan={2}>NO</th>
              <th className="p-2 border border-gray-400" rowSpan={2}>HARI</th>
              <th className="p-2 border border-gray-400" rowSpan={2}>TANGGAL</th>
              <th className="p-2 border border-gray-400 text-center" colSpan={3}>MASUK</th>
              <th className="p-2 border border-gray-400 text-center" colSpan={3}>PULANG</th>
              <th className="p-2 border border-gray-400 text-center" rowSpan={2}>KET</th>
            </tr>
            <tr className="bg-gray-200">
              <th className="p-1 border border-gray-400 text-center text-xs">PUKUL</th>
              <th className="p-1 border border-gray-400 text-center text-xs">SELISIH</th>
              <th className="p-1 border border-gray-400 text-center text-xs">STATUS</th>
              <th className="p-1 border border-gray-400 text-center text-xs">PUKUL</th>
              <th className="p-1 border border-gray-400 text-center text-xs">SELISIH</th>
              <th className="p-1 border border-gray-400 text-center text-xs">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 30 }).map((_, i) => {
              const selectedYear = new Date(selectedDate).getFullYear();
              const selectedMonth = new Date(selectedDate).getMonth();
              const baseDate = new Date(selectedYear, selectedMonth - 1, 26, 12, 0, 0);
              baseDate.setDate(baseDate.getDate() + i);
              
              const dateStr = baseDate.toISOString().split('T')[0];
              const record = attendanceRecords.find(r => r.date === dateStr);
              const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][baseDate.getDay()];
              const isWeekend = baseDate.getDay() === 0 || baseDate.getDay() === 6;
              
              return (
                <tr key={dateStr} className={`border-t ${isWeekend ? 'bg-gray-400' : ''}`}>
                  <td className="p-2 border border-gray-400 text-center">{i + 1}</td>
                  <td className="p-2 border border-gray-400">{dayName}</td>
                  <td className="p-2 border border-gray-400">{dateStr}</td>
                  <td className="p-2 border border-gray-400 text-center">{record?.checkInTime || ''}</td>
                  <td className="p-2 border border-gray-400 text-center"></td>
                  <td className="p-2 border border-gray-400 text-center"></td>
                  <td className="p-2 border border-gray-400 text-center">{record?.checkOutTime || ''}</td>
                  <td className="p-2 border border-gray-400 text-center"></td>
                  <td className="p-2 border border-gray-400 text-center"></td>
                  <td className="p-2 border border-gray-400 text-center">{record ? 'HADIR' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
