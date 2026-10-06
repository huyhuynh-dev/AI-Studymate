"use client";

import React from "react";
import Image from "next/image";
import { Camera, Calendar, Copy, LogOut, ShieldCheck } from "lucide-react";

export interface ProfileSidebarProps {
    user?: {
        name: string;
        email: string;
        avatarUrl?: string;
        memberType?: string;
        createdAt?: string;
        userId?: string;
    };
    onChangeAvatar?: () => void;
    onLogout?: () => void;
}

export default function ProfileSidebar({
    user = {
        name: "Nguyễn Văn A",
        email: "nguyen_van_a@example.com",
        avatarUrl:
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        memberType: "Thành viên cá nhân",
        createdAt: "Tháng 9, 2024",
        userId: "8f9a204e-4b2a-4c12-b91c-",
    },
    onChangeAvatar,
    onLogout,
}: ProfileSidebarProps) {
    const handleCopyId = () => {
        if (user.userId) {
            navigator.clipboard.writeText(user.userId);
        }
    };

    return (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm w-full">
            {/* Avatar */}
            <div className="relative">
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white shadow-md">
                    <Image
                        src={
                            user.avatarUrl ||
                            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                        }
                        alt={user.name}
                        width={96}
                        height={96}
                        unoptimized
                        className="h-full w-full object-cover"
                    />
                </div>
                {/* Online indicator */}
                <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
            </div>

            {/* Change Avatar Button */}
            <button
                type="button"
                onClick={onChangeAvatar}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-xs transition-all hover:border-indigo-300 hover:text-indigo-600 cursor-pointer"
            >
                <Camera className="h-3.5 w-3.5" />
                Thay đổi ảnh
            </button>

            {/* Name */}
            <div className="text-center">
                <p className="text-base font-bold text-gray-900">{user.name}</p>
                <span className="mt-1 inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                    {user.memberType}
                </span>
            </div>

            {/* Meta Info */}
            <div className="w-full space-y-3 border-t border-gray-100 pt-4">
                <div className="flex items-start gap-3">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    <div>
                        <p className="text-[11px] text-gray-400">Ngày tạo tài khoản</p>
                        <p className="text-sm font-semibold text-gray-700">{user.createdAt}</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-4 w-4 shrink-0 rounded-sm bg-gray-200" />
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-gray-400">Mã định danh (User ID)</p>
                        <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs font-mono text-gray-600">{user.userId}</p>
                            <button
                                type="button"
                                onClick={handleCopyId}
                                aria-label="Sao chép User ID"
                                className="shrink-0 text-gray-400 hover:text-indigo-600 transition-colors cursor-pointer"
                            >
                                <Copy className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Logout */}
            <button
                type="button"
                onClick={onLogout}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-all hover:bg-red-100 hover:border-red-200 cursor-pointer"
            >
                <LogOut className="h-4 w-4" />
                Đăng xuất tài khoản
            </button>

            {/* Security note */}
            <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[11px] text-gray-400">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                <p>Tài khoản được đảm bảo an toàn qua hạ tầng mã hóa AI StudyMate Cloud.</p>
            </div>
        </div>
    );
}

export { ProfileSidebar };
