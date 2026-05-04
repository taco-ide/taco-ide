"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface CsvImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

/**
 * Stub owned by Agent C. Kept here so Agent B can wire the trigger from the
 * members tab. Agent C will replace this file with the real implementation
 * keeping the same prop shape.
 */
export function CsvImportModal({ open, onOpenChange }: CsvImportModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar de CSV</DialogTitle>
          <DialogDescription className="text-slate-400">
            Em breve.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
