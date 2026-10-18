import { Activity, Building2, FileText, KeyRound, LayoutTemplate, Plug, ScrollText, Trash2, User, Users, FileSignature } from "lucide-react";

export type SettingsItem = {
  href: string;
  label: string;
  blurb: string;
  icon: any;
  /** Who may open it. "everyone" is any signed-in person. */
  who: "everyone" | "admin" | "templates";
};
export type SettingsGroup = { id: string; label: string; adminOnly: boolean; items: SettingsItem[] };

/** Every settings page, grouped the way the Settings home and the left menu show them. */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "you",
    label: "You",
    adminOnly: false,
    items: [
      { href: "/settings/account", label: "Profile and sign-in", blurb: "Your name, password, authenticator app and passkeys.", icon: User, who: "everyone" },
      { href: "/settings/proposal-templates", label: "Proposal templates", blurb: "Reusable groups of lines for proposals and change orders, yours or shared.", icon: LayoutTemplate, who: "templates" },
    ],
  },
  {
    id: "company",
    label: "Company",
    adminOnly: true,
    items: [
      { href: "/settings/company", label: "Company profile", blurb: "Company type, trades and how job numbers are made.", icon: Building2, who: "admin" },
      { href: "/settings/members", label: "Team members", blurb: "Invite people and choose what each role can do.", icon: Users, who: "admin" },
      { href: "/settings/proposal-terms", label: "Proposal terms", blurb: "The terms and conditions printed on every proposal you send.", icon: ScrollText, who: "admin" },
      { href: "/settings/change-order-terms", label: "Change order authorization", blurb: "The extra-work wording printed on every change order.", icon: FileSignature, who: "admin" },
      { href: "/settings/document-naming", label: "Document naming", blurb: "How generated PDFs are named.", icon: FileText, who: "admin" },
    ],
  },
  {
    id: "connections",
    label: "Connections and sign-in",
    adminOnly: true,
    items: [
      { href: "/settings/integrations", label: "QuickBooks Online", blurb: "Connection, what syncs, and sales tax.", icon: Plug, who: "admin" },
      { href: "/settings/sign-in", label: "Single sign-on", blurb: "Let your team sign in with Microsoft.", icon: KeyRound, who: "admin" },
    ],
  },
  {
    id: "records",
    label: "Records",
    adminOnly: true,
    items: [
      { href: "/settings/activity", label: "Activity log", blurb: "Who did what across the company.", icon: Activity, who: "admin" },
      { href: "/settings/deleted-projects", label: "Deleted projects", blurb: "Bring back a project removed in the last 30 days.", icon: Trash2, who: "admin" },
    ],
  },
];

export function canOpen(item: SettingsItem, orgRole: string | null): boolean {
  const isAdmin = !orgRole || orgRole === "org:admin";
  if (item.who === "everyone") return true;
  if (item.who === "admin") return isAdmin;
  return isAdmin || orgRole === "org:project_manager" || orgRole === "org:estimator";
}

/** The settings item a path belongs to (the callback page under integrations counts as integrations). */
export function itemForPath(pathname: string): SettingsItem | undefined {
  return SETTINGS_GROUPS.flatMap((g) => g.items).find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
}
