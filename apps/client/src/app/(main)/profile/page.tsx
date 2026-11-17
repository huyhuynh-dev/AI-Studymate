import {
    ProfileSidebar,
    PersonalInfoSection,
    SecuritySection,
    DangerZoneSection,
} from "@/components/profile";

export default function ProfilePage() {
    return (
        <main className="flex-1 overflow-y-auto bg-canvas px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-10">
            <div className="mx-auto w-full max-w-5xl">
                {/* Large title kiểu Apple: một tiêu đề, một câu mô tả */}
                <header className="mb-8">
                    <h1 className="font-heading text-3xl leading-[1.12] font-bold tracking-tight text-foreground sm:text-[34px]">
                        Hồ sơ
                    </h1>
                    <p className="mt-2 max-w-xl text-base text-muted">
                        Quản lý thông tin cá nhân và bảo mật tài khoản AI StudyMate.
                    </p>
                </header>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[288px_1fr] lg:items-start">
                    {/* Trái: danh tính, đứng yên khi cuộn trên desktop */}
                    <div className="lg:sticky lg:top-8">
                        <ProfileSidebar />
                    </div>

                    {/* Phải: các nhóm cài đặt */}
                    <div className="flex min-w-0 flex-col gap-6">
                        <PersonalInfoSection />
                        <SecuritySection />
                        <DangerZoneSection />
                    </div>
                </div>
            </div>
        </main>
    );
}
