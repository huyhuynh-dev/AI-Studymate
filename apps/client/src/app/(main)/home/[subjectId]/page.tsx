import ConversationsListView from "@/components/conversations/ConversationsListView";

export const metadata = {
    title: "Không gian học tập - AI StudyMate",
};

export default async function SubjectPage(props: { params: Promise<{ subjectId: string }> }) {
    const params = await props.params;
    const subjectId = params.subjectId;

    return (
        <div className="flex h-full min-h-125 items-start justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-6 sm:p-8 text-center text-gray-500 shadow-sm">
            <ConversationsListView subjectId={subjectId} className="w-full h-full" />
        </div>
    );
}
