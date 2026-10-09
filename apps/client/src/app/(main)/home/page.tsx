import SubjectCardListView from "@/components/home/SubjectCardListView";

export const metadata = {
  title: "Trang chủ - AI StudyMate",
  description: "Không gian học tập cá nhân của bạn",
};

export default function HomePage() {
  return (
    <div className="flex h-full min-h-125 items-stretch justify-stretch">
      <SubjectCardListView />
    </div>
  );
}