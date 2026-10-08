import ConversationsListView from "@/components/conversations/ConversationsListView";

export default function HomePage() {
  return (
    <div className="flex h-full min-h-[500px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-500 shadow-2xs">
      {/* <div className="space-y-1">
        
      </div> */}
      <ConversationsListView />
    </div>
  );
}