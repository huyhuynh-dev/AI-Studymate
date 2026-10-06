"use client";

import React, { useState } from "react";
import { User, Mail, CheckCircle2 } from "lucide-react";

export interface PersonalInfoSectionProps {
    defaultName?: string;
    defaultEmail?: string;
    emailVerified?: boolean;
    onSave?: (data: { name: string; email: string }) => void;
    onCancel?: () => void;
}

export default function PersonalInfoSection({
    defaultName = "Nguyễn Văn A",
    defaultEmail = "nguyen_van_a@example.com",
    emailVerified = true,
    onSave,
    onCancel,
}: PersonalInfoSectionProps) {
    const [name, setName] = useState(defaultName);
    const [email, setEmail] = useState(defaultEmail);

    const handleSave = () => {
        onSave?.({ name, email });
    };

    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                        <User className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-gray-900">Thông tin cá nhân</h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Cập nhật danh xưng và địa chỉ thư điện tử nhận thông báo.
                        </p>
                    </div>
                </div>
                <span className="text-xs font-medium text-gray-400">MỤC 01 / 03</span>
            </div>

            {/* Form */}
            <div className="space-y-5">
                {/* Full Name */}
                <div>
                    <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700" htmlFor="profile-name">
                            Họ và tên
                        </label>
                        <span className="text-xs text-gray-400">Bắt buộc</span>
                    </div>
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                            <User className="h-4 w-4" />
                        </div>
                        <input
                            id="profile-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all hover:border-gray-300 focus:border-indigo-400 focus:bg-white focus:ring-3 focus:ring-indigo-500/10"
                        />
                    </div>
                    <p className="mt-1.5 text-xs text-gray-400">
                        Tên sẽ hiện thị trên tài liệu học tập, các bộ thẻ flashcard và báo cáo tóm tắt.
                    </p>
                </div>

                {/* Email */}
                <div>
                    <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700" htmlFor="profile-email">
                            Địa chỉ Email
                        </label>
                        {emailVerified && (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600 border border-emerald-100">
                                <CheckCircle2 className="h-3 w-3" />
                                Đã xác thực
                            </span>
                        )}
                    </div>
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                            <Mail className="h-4 w-4" />
                        </div>
                        <input
                            id="profile-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all hover:border-gray-300 focus:border-indigo-400 focus:bg-white focus:ring-3 focus:ring-indigo-500/10"
                        />
                    </div>
                    <p className="mt-1.5 text-xs text-gray-400">
                        Email chính dùng để đăng nhập, phục hồi quyền truy cập và nhận tóm tắt học tập định kỳ.
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 cursor-pointer"
                >
                    Hủy
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95 cursor-pointer"
                >
                    <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                    Lưu thay đổi
                </button>
            </div>
        </div>
    );
}

export { PersonalInfoSection };
