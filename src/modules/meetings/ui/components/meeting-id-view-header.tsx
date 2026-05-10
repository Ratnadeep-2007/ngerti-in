import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import {
  ChevronRightIcon,
  TrashIcon,
  PencilIcon,
  MoreVertical,
  MoreVerticalIcon,
  Share2Icon,
  CopyIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  meetingId: string;
  meetingName: string;
  onEdit: () => void;
  onRemove: () => void;
}

export const MeetingIdViewHeader = ({
  meetingId,
  meetingName,
  onEdit,
  onRemove,
}: Props) => {
  const onCopyInvite = () => {
    const url = `${window.location.origin}/call/${meetingId}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied to clipboard!");
  };

  const onCopyId = () => {
    navigator.clipboard.writeText(meetingId);
    toast.success("Meeting ID copied to clipboard!");
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild className="font-medium text-xl">
                <Link href={"/dashboard/meetings"}>My Meeting</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-foreground text-xl font-medium [&>svg]:size-4">
              <ChevronRightIcon />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                className="font-medium text-xl text-foreground"
              >
                <Link href={`/dashboard/meetings/${meetingId}`}>
                  {meetingName}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        {/* without modal false,  the dialog that this dropdown opens cause the website to get stuck*/}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="hidden md:flex items-center gap-2"
            onClick={onCopyInvite}
          >
            <Share2Icon className="size-4" />
            Invite Others
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant={"ghost"}>
                <MoreVerticalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onCopyInvite} className="md:hidden">
                <Share2Icon className="size-4 text-black" />
                Copy Invite Link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCopyId}>
                <CopyIcon className="size-4 text-black" />
                Copy Meeting ID
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <PencilIcon className="size-4 text-black" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRemove}>
                <TrashIcon className="size-4 text-black" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
};
