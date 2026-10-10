import { EmptyState } from "@/components/empty-state";

export const CancelledState = () => {
    return (
        <div className="bg-card rounded-lg border px-4 py-8 flex flex-col gap-y-8 items-center justify-center">
            <EmptyState
                image="/cancelled.svg"
                title="Meeting Cancelled"
                description="This meeting was cancelled and cannot be joined."
            />
        </div>
    );
};
