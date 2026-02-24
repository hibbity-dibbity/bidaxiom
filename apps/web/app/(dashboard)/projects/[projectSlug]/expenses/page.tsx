"use client";

import { Receipt } from "lucide-react";

export default function ExpensesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Expenses</h1>
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-3 max-w-sm">
          <Receipt className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground text-sm">
            Expense tracking is coming soon. Check back in a future update.
          </p>
        </div>
      </div>
    </div>
  );
}
