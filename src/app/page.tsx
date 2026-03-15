"use client";

import { useState, useEffect } from "react";
import { useTaskStore } from "@/store/useTaskStore";
import { Onboarding } from "@/components/Onboarding";
import { TaskList } from "@/components/TaskList";

export default function Home() {
  const { users } = useTaskStore();
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  console.log("🔥 Basera Home Root Loaded. Users count:", users.length);

  useEffect(() => {
    if (isLoading) {
      // Upon initial load/hydration, if users exist, fast-forward to TaskList
      if (users.length > 0) {
        setIsOnboarded(true);
      }
      // Regardless, stop loading spinner after first hydration check
      // We use a tiny timeout to ensure hydration has settled
      setTimeout(() => setIsLoading(false), 50);
    }
  }, [users, isLoading]);

  if (isLoading) {
    return (
      <div className="size-full bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="size-full bg-background text-textMain min-h-screen">
      {!isOnboarded ? (
        <Onboarding onComplete={() => setIsOnboarded(true)} />
      ) : (
        <TaskList />
      )}
    </div>
  );
}
