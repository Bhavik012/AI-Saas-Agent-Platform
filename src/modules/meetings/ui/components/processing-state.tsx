import { EmptyState } from "@/components/empty-state";

export const ProcessingState = () => {
    return (
        <div className="bg-card rounded-lg border px-4 py-8 flex flex-col gap-y-8 items-center justify-center">
            <EmptyState
                image="/processing.svg"
                title="Processing Meeting Summary"
                description="This meeting has ended. AI is analyzing the transcript and generating notes."
            />
        </div>
    );
};
