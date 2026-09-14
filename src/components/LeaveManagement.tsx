import { useState, FormEvent } from 'react';
import { 
  FileText, 
  Plus, 
  Check, 
  X, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Calendar,
  UserCheck
} from 'lucide-react';
import { LeaveRequest, LeaveType, Employee } from '../types';
import { getTodayDateString, formatIndonesianDate } from '../utils/geo';

interface LeaveManagementProps {
  requests: LeaveRequest[];
  currentEmployee: Employee;
  employees: Employee[];
  onSubmitRequest: (newReq: Omit<LeaveRequest, 'id' | 'appliedAt' | 'status'>) => void;
  onUpdateStatus: (requestId: string, newStatus: 'Disetujui' | 'Ditolak') => void;
}

export default function LeaveManagement({
  requests,
  currentEmployee,
  employees,
  onSubmitRequest,
  onUpdateStatus,
}: LeaveManagementProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('Cuti Tahunan');
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [endDate, setEndDate] = useState(getTodayDateString());
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Calculate days between start and end
  const calculateDays = (start: string, end: string) => {
    try {
      const d1 = new Date(start);
      const d2 = new Date(end);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays > 0 ? diffDays : 1;
    } catch {
      return 1;
    }
  };

  const totalDays = calculateDays(startDate, endDate);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!reason.trim()) {
      setFormError('Mohon isi alasan pengajuan cuti atau izin');
      return;
    }

    if (leaveType === 'Cuti Tahunan' && totalDays > currentEmployee.remainingLeaveQuota) {
      setFormError(`Sisa kuota cuti tahunan Anda (${currentEmployee.remainingLeaveQuota} hari) tidak mencukupi untuk ${totalDays} hari.`);
      return;
    }

    onSubmitRequest({
      employeeId: currentEmployee.id,
      employeeName: currentEmployee.name,
      employeeNik: currentEmployee.nik,
      department: currentEmployee.department,
      type: leaveType,
      startDate,
      endDate,
      totalDays,
      reason: reason.trim(),
    });

    setIsModalOpen(false);
    setReason('');
  };

  return (
    <div className="space-y-6" id="leave-management-container">
      {/* Top Banner & Action */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">Manajemen Izin & Cuti Karyawan</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
              Sisa Cuti: {currentEmployee.remainingLeaveQuota} Hari
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ajukan permohonan cuti tahunan, surat izin sakit, atau dispensasi kerja untuk ditinjau oleh HRD
          </p>
        </div>

        <button
          type="button"
          id="btn-open-leave-modal"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Ajukan Izin / Cuti Baru</span>
        </button>
      </div>

      {/* List of Requests */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Daftar Riwayat Pengajuan ({requests.length})
          </span>
          <span className="text-xs text-slate-400">
            Termasuk pengajuan semua karyawan & persetujuan HRD
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 border-collapse">
            <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Karyawan</th>
                <th className="px-4 py-3">Jenis Pengajuan</th>
                <th className="px-4 py-3">Periode Tanggal</th>
                <th className="px-4 py-3">Durasi</th>
                <th className="px-4 py-3">Alasan / Keterangan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi HRD / Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    Belum ada pengajuan izin atau cuti yang terdaftar.
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const isPending = req.status === 'Menunggu';
                  const isApproved = req.status === 'Disetujui';
                  const isRejected = req.status === 'Ditolak';

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{req.employeeName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{req.employeeNik} • {req.department}</div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                          req.type === 'Cuti Tahunan'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : req.type === 'Sakit'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {req.type}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {req.startDate} s/d {req.endDate}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Diajukan: {req.appliedAt}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">
                        {req.totalDays} Hari
                      </td>

                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-slate-700 truncate" title={req.reason}>
                          {req.reason}
                        </p>
                        {req.notes && (
                          <p className="text-[10px] text-slate-400 italic">
                            Catatan HR: {req.notes}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          isApproved
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isRejected
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {isApproved && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {isRejected && <XCircle className="w-3 h-3 text-rose-600" />}
                          {isPending && <Clock className="w-3 h-3 text-amber-600" />}
                          {req.status}
                        </span>
                      </td>

                      {/* Action buttons for HR approval simulation */}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(req.id, 'Disetujui')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              title="Setujui permohonan"
                            >
                              <Check className="w-3 h-3" /> Setujui
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateStatus(req.id, 'Ditolak')}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Tolak permohonan"
                            >
                              <X className="w-3 h-3" /> Tolak
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Selesai diproses
                          </span>
                        )}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ajukan Cuti / Izin */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-bold text-slate-900">Form Pengajuan Izin & Cuti</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Employee info reminder */}
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-blue-900">{currentEmployee.name}</span>
                  <p className="text-blue-700 text-[11px]">{currentEmployee.nik} • {currentEmployee.department}</p>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[10px]">Sisa Cuti Tahunan</span>
                  <p className="font-bold text-blue-900 font-mono text-sm">{currentEmployee.remainingLeaveQuota} Hari</p>
                </div>
              </div>

              {/* Type of leave */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenis Pengajuan <span className="text-red-500">*</span>
                </label>
                <select
                  id="leave-type-select"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Cuti Tahunan">Cuti Tahunan (Mengurangi Kuota)</option>
                  <option value="Sakit">Sakit (Surat Dokter)</option>
                  <option value="Izin Pribadi">Izin Pribadi / Keperluan Mendesak</option>
                  <option value="Cuti Melahirkan">Cuti Melahirkan / Parental</option>
                </select>
              </div>

              {/* Date ranges */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Mulai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="leave-start-date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Selesai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="leave-end-date"
                    min={startDate}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="text-xs text-slate-500 flex items-center justify-between px-1">
                <span>Total Estimasi Hari Kerja:</span>
                <span className="font-bold text-slate-900 font-mono">{totalDays} Hari</span>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan / Keterangan Lengkap <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="leave-reason-textarea"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Tuliskan keterangan detail keperluan izin/cuti Anda..."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  id="submit-leave-request-btn"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs cursor-pointer"
                >
                  Kirim Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
