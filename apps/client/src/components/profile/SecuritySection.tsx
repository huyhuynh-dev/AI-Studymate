"use client";

import React, { useState } from "react";
import { Lock, Eye, EyeOff, KeyRound, Info } from "lucide-react";

export interface SecuritySectionProps {
    connectedProvider?: {
        name: string;
        email: string;
        logoSrc?: string;
        isActive?: boolean;
    };
    onManageConnection?: () => void;
    onUpdatePassword?: (data: {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
    }) => void;
}

export default function SecuritySection({
    connectedProvider = {
        name: "Google",
        email: "nguyen_van_a@example.com",
        isActive: true,
    },
    onManageConnection,
    onUpdatePassword,
}: SecuritySectionProps) {
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const handleUpdate = () => {
        onUpdatePassword?.({ currentPassword, newPassword, confirmPassword });
    };

    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                        <Lock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-gray-900">
                            Bảo mật &amp; Phương thức đăng nhập
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Quản lý nhà cung cấp OAuth liên kết và cập nhật mật khẩu truy cập.
                        </p>
                    </div>
                </div>
                <span className="text-xs font-medium text-gray-400">MỤC 02 / 03</span>
            </div>

            {/* Connected Accounts */}
            <div className="mb-6">
                <p className="mb-3 text-sm font-semibold text-gray-700">Tài khoản liên kết</p>
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                        {/* Google logo */}
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-xs border border-gray-100">
                            <svg viewBox="0 0 24 24" className="h-4 w-4">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-800">
                                    Đã liên kết với {connectedProvider.name}
                                </span>
                                {connectedProvider.isActive && (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                        Đang hoạt động
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-400">{connectedProvider.email}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onManageConnection}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-xs transition-all hover:border-gray-300 hover:text-indigo-600 cursor-pointer"
                    >
                        Quản lý liên kết
                    </button>
                </div>
            </div>

            {/* Change Password */}
            <div>
                <p className="text-sm font-semibold text-gray-700">Đổi mật khẩu tài khoản</p>
                <p className="mb-4 text-xs text-gray-400">
                    Nếu đăng nhập trực tiếp qua biểu mẫu, hãy đảm bảo mật khẩu có độ dài đủ tin cậy.
                </p>

                <div className="space-y-4">
                    {/* Current Password */}
                    <div>
                        <label
                            className="mb-1.5 block text-sm font-medium text-gray-700"
                            htmlFor="current-password"
                        >
                            Mật khẩu hiện tại
                        </label>
                        <div className="relative">
                            <input
                                id="current-password"
                                type={showCurrent ? "text" : "password"}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Nhập mật khẩu hiện tại"
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-10 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all hover:border-gray-300 focus:border-indigo-400 focus:bg-white focus:ring-3 focus:ring-indigo-500/10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrent(!showCurrent)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                            >
                                {showCurrent ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* New & Confirm Password side by side */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label
                                className="mb-1.5 block text-sm font-medium text-gray-700"
                                htmlFor="new-password"
                            >
                                Mật khẩu mới
                            </label>
                            <div className="relative">
                                <input
                                    id="new-password"
                                    type={showNew ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Mật khẩu mới"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-10 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all hover:border-gray-300 focus:border-indigo-400 focus:bg-white focus:ring-3 focus:ring-indigo-500/10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNew(!showNew)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                                >
                                    {showNew ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label
                                className="mb-1.5 block text-sm font-medium text-gray-700"
                                htmlFor="confirm-password"
                            >
                                Xác nhận mật khẩu mới
                            </label>
                            <div className="relative">
                                <input
                                    id="confirm-password"
                                    type={showConfirm ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Nhập lại mật khẩu mới"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-10 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all hover:border-gray-300 focus:border-indigo-400 focus:bg-white focus:ring-3 focus:ring-indigo-500/10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                                >
                                    {showConfirm ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Hint */}
                    <p className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Info className="h-3.5 w-3.5 text-indigo-400" />
                        Tối thiểu 8 ký tự bao gồm chữ và số.
                    </p>
                </div>

                {/* Submit */}
                <div className="mt-5 flex justify-end">
                    <button
                        type="button"
                        onClick={handleUpdate}
                        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-100 px-5 py-2 text-sm font-semibold text-gray-700 shadow-xs transition-all hover:bg-gray-200 active:scale-95 cursor-pointer"
                    >
                        <KeyRound className="h-4 w-4" />
                        Cập nhật mật khẩu
                    </button>
                </div>
            </div>
        </div>
    );
}

export { SecuritySection };
