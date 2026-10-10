import { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import {
    CommandResponsiveDialog,
    CommandInput,
    CommandItem,
    CommandList,
    CommandEmpty,
    CommandGroup,
} from "@/components/ui/command";
import { VideoIcon, BotIcon, PlusIcon } from "lucide-react";

interface Props {
    open: boolean;
    setOpen: Dispatch<SetStateAction<boolean>>;
}

export const DashboardCommand = ({ open, setOpen }: Props) => {
    const router = useRouter();

    const handleSelect = (url: string) => {
        setOpen(false);
        router.push(url);
    };

    return (
        <CommandResponsiveDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Search meetings, agents, or actions..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Navigation">
                    <CommandItem
                        onSelect={() => handleSelect("/meetings")}
                        className="cursor-pointer flex items-center gap-2"
                    >
                        <VideoIcon className="size-4 text-blue-500" />
                        <span>Meetings</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => handleSelect("/agents")}
                        className="cursor-pointer flex items-center gap-2"
                    >
                        <BotIcon className="size-4 text-purple-500" />
                        <span>AI Agents</span>
                    </CommandItem>
                </CommandGroup>
                <CommandGroup heading="Quick Actions">
                    <CommandItem
                        onSelect={() => handleSelect("/meetings")}
                        className="cursor-pointer flex items-center gap-2"
                    >
                        <PlusIcon className="size-4" />
                        <span>Create new meeting</span>
                    </CommandItem>
                    <CommandItem
                        onSelect={() => handleSelect("/agents")}
                        className="cursor-pointer flex items-center gap-2"
                    >
                        <PlusIcon className="size-4" />
                        <span>Create new agent</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandResponsiveDialog>
    );
};