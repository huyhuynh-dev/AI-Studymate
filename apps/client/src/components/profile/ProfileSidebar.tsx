"use client";

import Image from "next/image";
import { Calendar, Camera, LogOut } from "lucide-react";
import { Button, Pill } from "./shared";

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

const DEFAULT_USER: NonNullable<ProfileSidebarProps["user"]> = {
    name: "Nguyễn Văn A",
    email: "nguyen_van_a@example.com",
    memberType: "Thành viên cá nhân",
    createdAt: "Tháng 9, 2024",
};

/** Họ tên Việt: lấy chữ cái đầu của từ đầu và từ cuối ("Nguyễn Văn A" → "NA"). */
function getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    const first = Array.from(words[0])[0];
    const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : "";
    return (first + last).toUpperCase();
}

export default function ProfileSidebar({
    user = DEFAULT_USER,
    onChangeAvatar,
    onLogout,
}: ProfileSidebarProps) {
    return (
        // Đồng tâm: thẻ ngoài 24px, padding 8px → vùng lõm bên trong 16px.
        <aside
            aria-label="Thông tin hồ sơ"
            className="rounded-3xl border border-hairline bg-card p-2 shadow-[0_1px_2px_rgba(11,28,48,0.04)]"
        >
            <div className="flex items-center gap-4 rounded-2xl bg-well p-4 lg:flex-col lg:p-6 lg:text-center">
                <button
                    type="button"
                    onClick={onChangeAvatar}
                    aria-label="Thay đổi ảnh đại diện"
                    className="group relative size-16 shrink-0 cursor-pointer rounded-full transition-transform duration-350 ease-apple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-[0.97] motion-reduce:transition-none lg:size-24"
                >
                    <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-hairline">
                        {user.avatarUrl ? (
                            <Image
                                src={user.avatarUrl}
                                alt=""
                                width={96}
                                height={96}
                                unoptimized
                                className="size-full object-cover"
                            />
                        ) : (
                            <span
                                aria-hidden
                                className="font-heading text-xl font-semibold tracking-tight text-primary lg:text-3xl"
                            >
                                {getInitials(user.name)}
                            </span>
                        )}
                    </span>
                    <span className="absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full bg-primary text-white ring-2 ring-card transition-colors group-hover:bg-primary-hover lg:size-8">
                        <Camera className="size-3.5 lg:size-4" aria-hidden />
                    </span>
                </button>

                <div className="min-w-0 lg:flex lg:flex-col lg:items-center">
                    <p className="truncate font-heading text-lg font-semibold tracking-tight text-foreground lg:text-xl">
                        {user.name}
                    </p>
                    <p className="truncate text-sm text-muted">{user.email}</p>
                    {user.memberType && (
                        <div className="mt-2">
                            <Pill tone="accent">{user.memberType}</Pill>
                        </div>
                    )}
                </div>
            </div>

            {user.createdAt && (
                <dl className="px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                        <dt className="flex items-center gap-2 text-sm text-muted">
                            <Calendar className="size-4" aria-hidden />
                            Tham gia từ
                        </dt>
                        <dd className="text-sm font-medium text-foreground tabular-nums">
                            {user.createdAt}
                        </dd>
                    </div>
                </dl>
            )}

            <div className="p-2 pt-0">
                <Button variant="danger-quiet" onClick={onLogout} className="w-full">
                    <LogOut className="size-4" aria-hidden />
                    Đăng xuất
                </Button>
            </div>
        </aside>
    );
}

export { ProfileSidebar };
