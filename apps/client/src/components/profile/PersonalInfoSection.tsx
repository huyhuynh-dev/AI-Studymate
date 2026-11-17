"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Pencil } from "lucide-react";
import { Button, Pill, Row, RowGroup, SectionCard, TextField } from "./shared";

export interface PersonalInfoSectionProps {
    defaultName?: string;
    defaultEmail?: string;
    emailVerified?: boolean;
    /** Mặc định false: email do nhà cung cấp đăng nhập quản lý, chỉ cho sửa Họ và tên. */
    allowEmailChange?: boolean;
    onSave?: (data: { name: string; email: string }) => void | Promise<void>;
    onCancel?: () => void;
}

interface Profile {
    name: string;
    email: string;
}

interface FormErrors {
    name?: string;
    email?: string;
    form?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(profile: Profile, allowEmailChange: boolean): FormErrors {
    const errors: FormErrors = {};
    if (!profile.name) errors.name = "Vui lòng nhập họ và tên.";
    if (allowEmailChange && !EMAIL_PATTERN.test(profile.email)) {
        errors.email = "Địa chỉ email chưa hợp lệ.";
    }
    return errors;
}

export default function PersonalInfoSection({
    defaultName = "Nguyễn Văn A",
    defaultEmail = "nguyen_van_a@example.com",
    emailVerified = true,
    allowEmailChange = false,
    onSave,
    onCancel,
}: PersonalInfoSectionProps) {
    const [saved, setSaved] = useState<Profile>({ name: defaultName, email: defaultEmail });
    const [draft, setDraft] = useState<Profile>(saved);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});

    const startEditing = () => {
        setDraft(saved);
        setErrors({});
        setIsEditing(true);
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setErrors({});
        onCancel?.();
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const next = { name: draft.name.trim(), email: draft.email.trim() };

        const found = validate(next, allowEmailChange);
        if (Object.keys(found).length > 0) {
            setErrors(found);
            return;
        }

        setIsSaving(true);
        try {
            await onSave?.(next);
            setSaved(next);
            setIsEditing(false);
            setErrors({});
        } catch {
            setErrors({ form: "Không thể lưu thay đổi. Vui lòng thử lại." });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SectionCard
            id="personal-info"
            title="Thông tin cá nhân"
            description="Tên và email dùng trên tài liệu học tập và thông báo."
            action={
                !isEditing && (
                    <Button variant="tertiary" onClick={startEditing}>
                        <Pencil className="size-4" aria-hidden />
                        Chỉnh sửa
                    </Button>
                )
            }
        >
            {isEditing ? (
                <form
                    onSubmit={handleSubmit}
                    noValidate
                    className="space-y-5 border-t border-line px-6 py-6"
                >
                    <TextField
                        label="Họ và tên"
                        autoComplete="name"
                        autoFocus
                        required
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        error={errors.name}
                        hint="Hiển thị trên tài liệu, bộ flashcard và báo cáo tóm tắt."
                    />
                    <TextField
                        label="Địa chỉ email"
                        type="email"
                        autoComplete="email"
                        readOnly={!allowEmailChange}
                        value={draft.email}
                        onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                        error={errors.email}
                        hint={
                            allowEmailChange
                                ? "Dùng để đăng nhập, khôi phục truy cập và nhận tóm tắt học tập."
                                : "Email được quản lý bởi phương thức đăng nhập của bạn."
                        }
                    />

                    {errors.form && (
                        <p role="alert" className="text-sm text-error">
                            {errors.form}
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-2">
                        <Button onClick={cancelEditing} disabled={isSaving}>
                            Hủy
                        </Button>
                        <Button type="submit" variant="primary" isLoading={isSaving}>
                            Lưu thay đổi
                        </Button>
                    </div>
                </form>
            ) : (
                <RowGroup>
                    <Row label="Họ và tên">
                        <span className="text-sm text-muted">{saved.name}</span>
                    </Row>
                    <Row label="Email">
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <span className="text-sm break-all text-muted">{saved.email}</span>
                            {emailVerified && (
                                <Pill
                                    tone="success"
                                    icon={<CheckCircle2 className="size-3.5" aria-hidden />}
                                >
                                    Đã xác thực
                                </Pill>
                            )}
                        </div>
                    </Row>
                </RowGroup>
            )}
        </SectionCard>
    );
}

export { PersonalInfoSection };
