"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQueries } from "@tanstack/react-query";
import {
    VideoIcon,
    BotIcon,
    PlusIcon,
    ArrowRightIcon,
    CalendarIcon
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewMeetingDialog } from "@/modules/meetings/ui/components/new-meeting-dialog";
import { NewAgentDialog } from "@/modules/agents/ui/components/new-agent-dialog";
import { format } from "date-fns";

export const HomeView = () => {
    const trpc = useTRPC();
    const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
    const [agentDialogOpen, setAgentDialogOpen] = useState(false);

    const [
        { data: meetingsData },
        { data: agentsData },
        { data: activeMeetingsData }
    ] = useSuspenseQueries({
        queries: [
            trpc.meetings.getMany.queryOptions({ pageSize: 5 }),
            trpc.agents.getMany.queryOptions({ pageSize: 5 }),
            trpc.meetings.getMany.queryOptions({ status: "active", pageSize: 1 }),
        ]
    });

    return (
        <div className="flex-1 p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
            <NewMeetingDialog
                open={meetingDialogOpen}
                onOpenChange={setMeetingDialogOpen}
            />
            <NewAgentDialog
                open={agentDialogOpen}
                onOpenChange={setAgentDialogOpen}
            />

            {/* Welcome Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground mt-1 text-lg">
                        Manage your AI meetings and intelligent agents.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => setAgentDialogOpen(true)}
                        variant="outline"
                        className="rounded-full shadow-sm"
                    >
                        <BotIcon className="mr-2 size-4" />
                        New Agent
                    </Button>
                    <Button
                        onClick={() => setMeetingDialogOpen(true)}
                        className="rounded-full shadow-lg bg-primary hover:bg-primary/90"
                    >
                        <PlusIcon className="mr-2 size-4" />
                        Create Meeting
                    </Button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-none shadow-md bg-gradient-to-br from-blue-500/10 to-transparent">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
                        <VideoIcon className="size-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{meetingsData.total}</div>
                        <p className="text-xs text-muted-foreground mt-1">Across all categories</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-md bg-gradient-to-br from-purple-500/10 to-transparent">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">AI Agents</CardTitle>
                        <BotIcon className="size-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{agentsData.total}</div>
                        <p className="text-xs text-muted-foreground mt-1">Ready for deployment</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-md bg-gradient-to-br from-green-500/10 to-transparent">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active Now</CardTitle>
                        <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {activeMeetingsData.total}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Ongoing sessions</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
                {/* Recent Meetings */}
                <Card className="border-none shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Recent Meetings</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">Your latest conversation history</p>
                        </div>
                        <Button variant="ghost" size="sm" asChild className="rounded-full">
                            <Link href="/meetings">
                                View All
                                <ArrowRightIcon className="ml-2 size-4" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {meetingsData.items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <VideoIcon className="size-10 text-muted-foreground/30 mb-4" />
                                <p className="text-sm text-muted-foreground">No meetings yet</p>
                            </div>
                        ) : (
                            meetingsData.items.map((meeting) => (
                                <Link
                                    key={meeting.id}
                                    href={`/meetings/${meeting.id}`}
                                    className="flex items-center justify-between p-4 rounded-xl border border-transparent hover:border-border hover:bg-accent/50 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                            <CalendarIcon className="size-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold">{meeting.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(meeting.createdAt), "MMM d, yyyy • h:mm a")}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant={meeting.status === "completed" ? "secondary" : "default"}>
                                        {meeting.status}
                                    </Badge>
                                </Link>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* My Agents */}
                <Card className="border-none shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>AI Agents</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">Manage your intelligent assistants</p>
                        </div>
                        <Button variant="ghost" size="sm" asChild className="rounded-full">
                            <Link href="/agents">
                                Manage
                                <ArrowRightIcon className="ml-2 size-4" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {agentsData.items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <BotIcon className="size-10 text-muted-foreground/30 mb-4" />
                                <p className="text-sm text-muted-foreground">No agents created</p>
                            </div>
                        ) : (
                            agentsData.items.map((agent) => (
                                <Link
                                    key={agent.id}
                                    href={`/agents/${agent.id}`}
                                    className="flex items-center justify-between p-4 rounded-xl border border-transparent hover:border-border hover:bg-accent/50 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-foreground group-hover:bg-foreground group-hover:text-background transition-colors">
                                            <BotIcon className="size-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold">{agent.name}</p>
                                            <p className="text-xs text-muted-foreground line-clamp-1">
                                                {agent.instructions}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant="outline">
                                        Active
                                    </Badge>
                                </Link>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};