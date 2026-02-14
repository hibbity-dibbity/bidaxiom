import { ThemeToggle } from "@/components/settings/theme-toggle";

/**
 * Account Settings page.
 * Allows users to configure personal account preferences.
 */
export default function AccountSettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your personal account preferences
        </p>
      </div>

      <ThemeToggle />
    </div>
  );
}
