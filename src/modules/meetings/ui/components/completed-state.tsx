"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LoaderIcon, BrainIcon, MessageSquareIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
    meetingId: string;
    summary?: string | null;
}

export const CompletedState = ({ meetingId, summary: initialSummary }: Props) => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const { data: transcripts, isLoading: transcriptsLoading } = useQuery(
        trpc.meetings.getTranscriptions.queryOptions({ meetingId })
    );

    const generateSummary = useMutation(
        trpc.meetings.generateSummary.mutationOptions({
            onSuccess: () => {
                toast.success("Summary generated successfully!");
                queryClient.invalidateQueries(trpc.meetings.getOne.queryOptions({ id: meetingId }));
            },
            onError: (error) => {
                toast.error(error.message);
            }
        })
    );

    return (
        <div className="space-y-6">
            {/* Summary Section */}
            <div className="bg-card rounded-xl border p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-x-2">
                        <BrainIcon className="size-5 text-blue-600" />
                        <h3 className="text-lg font-semibold">AI Summary</h3>
                    </div>
                    {!initialSummary && (
                        <Button
                            onClick={() => generateSummary.mutate({ meetingId })}
                            disabled={generateSummary.isPending}
                            size="sm"
                        >
                            {generateSummary.isPending ? (
                                <LoaderIcon className="size-4 animate-spin mr-2" />
                            ) : (
                                <BrainIcon className="size-4 mr-2" />
                            )}
                            Generate Summary
                        </Button>
                    )}
                </div>
                {initialSummary ? (
                    <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                        {initialSummary}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground italic">
                        No summary generated yet. Click the button above to process the meeting notes.
                    </p>
                )}
            </div>

            {/* Transcripts Section */}
            <div className="bg-card rounded-xl border p-6 shadow-sm">
                <div className="flex items-center gap-x-2 mb-4">
                    <MessageSquareIcon className="size-5 text-green-600" />
                    <h3 className="text-lg font-semibold">Meeting Transcripts</h3>
                </div>
                {transcriptsLoading ? (
                    <div className="flex justify-center py-8">
                        <LoaderIcon className="size-8 animate-spin text-muted-foreground" />
                    </div>
                ) : transcripts && transcripts.length > 0 ? (
                    <div className="space-y-4">
                        {transcripts.map((t) => (
                            <div key={t.id} className="flex flex-col gap-y-1 pb-4 border-b last:border-0">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-blue-600">
                                        {t.agentId ? "AI Assistant" : "Participant"}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                        {format(new Date(t.timestamp), "p")}
                                    </span>
                                </div>
                                <p className="text-sm text-foreground">{t.text}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground italic">
                        No transcriptions recorded for this meeting.
                    </p>
                )}
            </div>
        </div>
    );
};
