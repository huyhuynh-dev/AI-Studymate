import ConversationsListView from "@/components/conversations/ConversationsListView";

export default async function HomePage(props: { searchParams: Promise<{ subject_id?: string }> }) {
  const searchParams = await props.searchParams;
  const subjectId = searchParams.subject_id;

  return (
    <div className="flex h-full min-h-125 items-start justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-500 shadow-2xs">
      <ConversationsListView subjectId={subjectId} />
    </div>

    //     <div className="flex h-full min-h-[500px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-500 shadow-2xs">
    //   <ConversationsListView subjectId={subjectId} />
    // </div>
  );
}