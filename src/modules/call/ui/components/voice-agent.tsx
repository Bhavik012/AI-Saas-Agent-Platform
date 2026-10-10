"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import {
    LiveKitRoom,
    RoomAudioRenderer,
    VoiceAssistantControlBar,
    BarVisualizer,
} from "@livekit/components-react";
import { useEffect, useState } from "react";
import { LoaderIcon } from "lucide-react";

import "@livekit/components-styles";

interface Props {
    meetingId: string;
}

export const VoiceAgent = ({ meetingId }: Props) => {
    const trpc = useTRPC();
    const [token, setToken] = useState<string>();
    const [error, setError] = useState<string | null>(null);

    const { mutateAsync: generateToken } = useMutation(
        trpc.meetings.generateLiveKitToken.mutationOptions()
    );

    const livekitUrl =
        process.env.NEXT_PUBLIC_LIVEKIT_URL ||
        process.env.LIVEKIT_WS_URL;

    useEffect(() => {
        let isMounted = true;
        const fetchToken = async () => {
            try {
                setError(null);
                const t = await generateToken({ meetingId });
                if (isMounted) {
                    setToken(t);
                }
            } catch (err: unknown) {
                if (isMounted) {
                    const message = err instanceof Error ? err.message : "Failed to connect AI Agent";
                    setError(message);
                }
            }
        };
        fetchToken();

        return () => {
            isMounted = false;
        };
    }, [meetingId, generateToken]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-4 bg-destructive/10 text-destructive rounded-xl text-center text-xs gap-y-2">
                <p>AI Agent Connection Error</p>
                <p className="text-[10px] opacity-80">{error}</p>
            </div>
        );
    }

    if (!token) {
        return (
            <div className="flex items-center gap-x-2 text-sm text-muted-foreground">
                <LoaderIcon className="size-4 animate-spin" />
                Connecting AI Agent...
            </div>
        );
    }

    if (!livekitUrl) {
        return (
            <div className="flex items-center gap-x-2 text-sm text-amber-500">
                LiveKit server URL not configured
            </div>
        );
    }

    return (
        <LiveKitRoom
            token={token}
            serverUrl={livekitUrl}
            connect={true}
            audio={true}
            video={false}
            className="flex flex-col h-full"
        >
            <div className="flex flex-col items-center justify-center gap-y-4 p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                <div className="size-20 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/50 relative">
                    <BarVisualizer />
                </div>
                <div className="text-center">
                    <p className="text-sm font-medium text-white">AI Meeting Assistant</p>
                    <p className="text-xs text-white/60">Listening & Recording</p>
                </div>
                <VoiceAssistantControlBar />
            </div>
            <RoomAudioRenderer />
        </LiveKitRoom>
    );
};
