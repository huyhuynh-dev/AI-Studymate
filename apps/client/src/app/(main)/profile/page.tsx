import {
    ProfileSidebar,
    PersonalInfoSection,
    SecuritySection,
    DangerZoneSection,
} from "@/components/profile";

export default function ProfilePage() {
    return (
        <main className="relative flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6 transition-all duration-300">
            {/* Page Title */}
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                            Hồ sơ &amp; Cài đặt tài khoản
                        </h1>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Tài khoản đang hoạt động
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                        Quản lý thông tin cá nhân, địa chỉ email và phương thức bảo mật tài khoản AI StudyMate.
                    </p>
                </div>
                <span className="hidden shrink-0 rounded-lg border border-gray-100 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 shadow-xs sm:inline-block">
                    v2.4.0 • Enterprise Core
                </span>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
                {/* Left: Profile Card */}
                <div className="lg:sticky lg:top-6 lg:self-start">
                    <ProfileSidebar />
                </div>

                {/* Right: Settings Sections */}
                <div className="flex flex-col gap-6">
                    <PersonalInfoSection />
                    <SecuritySection />
                    <DangerZoneSection />
                </div>
            </div>
        </main>
    );
}
