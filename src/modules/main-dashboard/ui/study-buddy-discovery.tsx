"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Users, ArrowRight, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { GeneratedAvatar } from "@/components/generated-avatar";

export const StudyBuddyDiscovery = () => {
  const trpc = useTRPC();
  const { data: activeMeetings } = useSuspenseQuery(
    trpc.meetings.getDiscoverableMeetings.queryOptions(),
  );

  if (!activeMeetings || activeMeetings.length === 0) return null;

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-orange-600" />
        <h3 className="text-xl font-bold">Study Buddy Discovery</h3>
      </div>
      <p className="text-muted-foreground text-sm">
        These students are currently studying topics related to your interests.
        Join them for a collaborative session!
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeMeetings.map((meeting) => (
          <Card
            key={meeting.id}
            className="group hover:border-orange-200 transition-all duration-300 overflow-hidden shadow-sm"
          >
            <CardContent className="p-0">
              <div className="flex">
                <div className="w-2 bg-orange-500" />
                <div className="flex-1 p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <GeneratedAvatar
                        seed={meeting.creator.name}
                        variant="initials"
                        className="size-10 ring-2 ring-orange-50 ring-offset-2"
                      />
                      <div>
                        <h4 className="font-bold text-gray-900 group-hover:text-orange-700 transition-colors">
                          {meeting.creator.name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Studying {meeting.agent.subject}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-orange-50 text-orange-700 border-orange-100 flex items-center gap-1 px-2 py-0.5"
                    >
                      <div className="size-1.5 rounded-full bg-orange-500 animate-pulse" />
                      Live Now
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-700 line-clamp-1">
                      {meeting.name}
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {meeting.agent.name}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <div className="flex -space-x-2">
                       {/* Placeholder for other participants if any */}
                       <div className="size-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] text-gray-400">
                         +1
                       </div>
                    </div>
                    <Link href={`/call/${meeting.id}`}>
                      <Button
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white gap-2 h-8 px-4"
                      >
                        <UserPlus className="size-3.5" />
                        Join Buddy
                        <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
