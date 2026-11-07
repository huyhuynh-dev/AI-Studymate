import { SubjectCardListView } from "@/components/subjects";

export const metadata = {
  title: "Trang chủ - AI StudyMate",
  description: "Không gian học tập cá nhân của bạn",
};

export default function HomePage() {
  return (
    <div className="flex-1 w-full flex flex-col">
      <SubjectCardListView />
    </div>
  );
}
