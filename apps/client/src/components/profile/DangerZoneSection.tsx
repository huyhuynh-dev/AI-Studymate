"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

export interface DangerZoneSectionProps {
    onDeleteAccount?: () => void;
}

export default function DangerZoneSection({ onDeleteAccount }: DangerZoneSectionProps) {
    const [isConfirming, setIsConfirming] = useState(false);

    const handleDeleteClick = () => {
        if (isConfirming) {
            onDeleteAccount?.();
            setIsConfirming(false);
        } else {
            setIsConfirming(true);
        }
    };

    return (
        <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
            {/* Header */}
            <div className="mb-5 flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Vùng nguy hiểm</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Hành động vĩnh viễn không thể khôi phục dữ liệu đã lưu trữ.
                        </p>
                    </div>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-red-500">CẢNH BÁO</span>
            </div>

            {/* Delete Account Card */}
            <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800">Xóa tài khoản vĩnh viễn</p>
                        <p className="mt-1 text-xs text-gray-500">
                            Mọi tài liệu tải lên, tóm tắt bài giảng AI và các bộ flashcards cá nhân sẽ bị xóa hoàn
                            toàn khỏi cơ sở dữ liệu.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleDeleteClick}
                        className={`shrink-0 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all active:scale-95 cursor-pointer ${
                            isConfirming
                                ? "bg-red-700 hover:bg-red-800"
                                : "bg-red-600 hover:bg-red-700"
                        }`}
                    >
                        <Trash2 className="h-4 w-4" />
                        {isConfirming ? "Xác nhận xóa" : "Xóa tài khoản"}
                    </button>
                </div>

                {isConfirming && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-100 p-3 text-xs text-red-700">
                        ⚠️ Bạn có chắc chắn? Hành động này không thể hoàn tác. Nhấn &quot;Xác nhận xóa&quot; để
                        tiếp tục hoặc làm mới trang để hủy.
                    </div>
                )}
            </div>
        </div>
    );
}

export { DangerZoneSection };
