import React from "react";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { prisma } from "@/lib/prisma";

export default async function ParticipantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  const eventSettings = await prisma.eventSetting.findFirst({
    select: {
      eventName: true,
      eventStatus: true,
    },
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar
        eventName={eventSettings?.eventName}
        eventStatus={eventSettings?.eventStatus}
      />
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
