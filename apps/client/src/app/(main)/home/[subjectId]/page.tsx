import ConversationsListView from "@/components/conversations/ConversationsListView";

export const metadata = {
    title: "Không gian học tập - AI StudyMate",
};

export default async function SubjectPage(props: { params: Promise<{ subjectId: string }> }) {
    const params = await props.params;
    const subjectId = params.subjectId;

    return (
        <div className="flex-1 w-full flex flex-col">
            <ConversationsListView subjectId={subjectId} className="w-full flex-1" />
        </div>
    );
}
