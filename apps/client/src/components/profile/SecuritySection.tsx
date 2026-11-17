"use client";

import { useId, useState, type FormEvent } from "react";
import Image from "next/image";
import { Check, Circle, Eye, EyeOff, Link2 } from "lucide-react";
import {
    Button,
    Pill,
    Row,
    RowGroup,
    SectionCard,
    TextField,
    cn,
    type TextFieldProps,
} from "./shared";

interface PasswordChangeData {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export interface SecuritySectionProps {
    connectedProvider?: {
        name: string;
        email: string;
        logoSrc?: string;
        isActive?: boolean;
    };
    onManageConnection?: () => void;
    onUpdatePassword?: (data: PasswordChangeData) => void | Promise<void>;
}

const DEFAULT_PROVIDER: NonNullable<SecuritySectionProps["connectedProvider"]> = {
    name: "Google",
    email: "nguyen_van_a@example.com",
    isActive: true,
};

const PASSWORD_RULES = [
    { id: "length", label: "Tối thiểu 8 ký tự", test: (v: string) => v.length >= 8 },
    { id: "letter", label: "Có chữ cái", test: (v: string) => /\p{L}/u.test(v) },
    { id: "number", label: "Có chữ số", test: (v: string) => /\d/.test(v) },
] as const;

/* ───────── Logo nhà cung cấp ───────── */

function GoogleMark() {
    return (
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
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
    );
}

function ProviderLogo({ name, logoSrc }: { name: string; logoSrc?: string }) {
    let mark;
    if (logoSrc) {
        mark = <Image src={logoSrc} alt="" width={20} height={20} unoptimized className="size-5" />;
    } else if (name === "Google") {
        mark = <GoogleMark />;
    } else {
        mark = <Link2 className="size-5 text-muted" aria-hidden />;
    }
    return (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-raised">
            {mark}
        </span>
    );
}

/* ───────── Ô mật khẩu có nút hiện/ẩn ───────── */

function PasswordField(props: Omit<TextFieldProps, "type" | "trailing">) {
    const [visible, setVisible] = useState(false);
    return (
        <TextField
            {...props}
            type={visible ? "text" : "password"}
            trailing={
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    aria-pressed={visible}
                    className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                    {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
            }
        />
    );
}

/* ───────── Section ───────── */

export default function SecuritySection({
    connectedProvider = DEFAULT_PROVIDER,
    onManageConnection,
    onUpdatePassword,
}: SecuritySectionProps) {
    const panelId = useId();
    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

    const ruleResults = PASSWORD_RULES.map((rule) => rule.test(newPassword));
    const isMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
    const canSubmit =
        currentPassword.length > 0 && ruleResults.every(Boolean) && confirmPassword === newPassword;

    const resetForm = () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
    };

    const togglePanel = () => {
        setIsOpen((open) => !open);
        setStatus("idle");
    };

    const closePanel = () => {
        setIsOpen(false);
        resetForm();
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canSubmit) return;

        setIsSaving(true);
        setStatus("idle");
        try {
            await onUpdatePassword?.({ currentPassword, newPassword, confirmPassword });
            resetForm();
            setIsOpen(false);
            setStatus("success");
        } catch {
            setStatus("error");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SectionCard
            id="security"
            title="Bảo mật"
            description="Phương thức đăng nhập và mật khẩu của bạn."
        >
            <RowGroup>
                <Row
                    label={`Đăng nhập bằng ${connectedProvider.name}`}
                    description={connectedProvider.email}
                    leading={
                        <ProviderLogo name={connectedProvider.name} logoSrc={connectedProvider.logoSrc} />
                    }
                >
                    <div className="flex items-center gap-3">
                        {connectedProvider.isActive && <Pill tone="success">Đang hoạt động</Pill>}
                        <Button onClick={onManageConnection}>Quản lý</Button>
                    </div>
                </Row>

                <Row
                    label="Mật khẩu"
                    description={
                        status === "success" ? (
                            <span className="text-secondary">Đã cập nhật mật khẩu thành công.</span>
                        ) : (
                            "Áp dụng khi bạn đăng nhập trực tiếp bằng email và mật khẩu."
                        )
                    }
                >
                    <Button
                        onClick={togglePanel}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                    >
                        {isOpen ? "Đóng" : "Đổi mật khẩu"}
                    </Button>
                </Row>
            </RowGroup>

            {/* Mở rộng bằng grid-rows (không cần đo chiều cao); `inert` khi đóng để không tab vào được. */}
            <div
                id={panelId}
                className={cn(
                    "grid transition-[grid-template-rows] duration-350 ease-apple motion-reduce:transition-none",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
            >
                <div className="overflow-hidden" inert={!isOpen}>
                    <form
                        onSubmit={handleSubmit}
                        noValidate
                        className="space-y-4 border-t border-line px-6 py-6"
                    >
                        <PasswordField
                            label="Mật khẩu hiện tại"
                            autoComplete="current-password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                        />

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <PasswordField
                                label="Mật khẩu mới"
                                autoComplete="new-password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <PasswordField
                                label="Nhập lại mật khẩu mới"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                error={isMismatch ? "Mật khẩu nhập lại chưa khớp." : undefined}
                            />
                        </div>

                        <ul aria-label="Yêu cầu mật khẩu" className="flex flex-wrap gap-x-5 gap-y-1.5">
                            {PASSWORD_RULES.map((rule, index) => {
                                const met = ruleResults[index];
                                return (
                                    <li
                                        key={rule.id}
                                        className={cn(
                                            "flex items-center gap-1.5 text-xs transition-colors duration-350",
                                            met ? "text-secondary" : "text-muted",
                                        )}
                                    >
                                        {met ? (
                                            <Check className="size-3.5" aria-hidden />
                                        ) : (
                                            <Circle className="size-3.5" aria-hidden />
                                        )}
                                        {rule.label}
                                        <span className="sr-only">{met ? " (đã đạt)" : " (chưa đạt)"}</span>
                                    </li>
                                );
                            })}
                        </ul>

                        {status === "error" && (
                            <p role="alert" className="text-sm text-error">
                                Không thể cập nhật mật khẩu. Kiểm tra mật khẩu hiện tại rồi thử lại.
                            </p>
                        )}

                        <div className="flex items-center justify-end gap-2">
                            <Button onClick={closePanel} disabled={isSaving}>
                                Hủy
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={!canSubmit}
                                isLoading={isSaving}
                            >
                                Cập nhật mật khẩu
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </SectionCard>
    );
}

export { SecuritySection };
