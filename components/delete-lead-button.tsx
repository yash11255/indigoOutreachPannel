"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteLead } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onDelete() {
    if (!confirm("Delete this lead? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        await deleteLead(leadId);
        toast.success("Lead deleted");
        router.push("/leads");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to delete lead");
      }
    });
  }

  return (
    <Button
      variant="ghost"
      className="text-[#da1e28] hover:bg-[#fff1f1] hover:text-[#da1e28]"
      onClick={onDelete}
      disabled={pending}
    >
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
