export type Shot = { src: string; alt: string; caption: string };
export type Step = { title: string; body: string[]; shot?: Shot; tip?: string; warn?: string };
export type Article = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  intro: string;
  /** Rough time to follow it. */
  minutes: number;
  steps: Step[];
  related: string[];
};

export const CATEGORIES: { name: string; blurb: string }[] = [
  { name: "Getting started", blurb: "Invite your team, choose roles and set up the basics." },
  { name: "QuickBooks Online", blurb: "Connect, choose accounts and tax codes, and understand what syncs." },
  { name: "Sign-in and security", blurb: "Single sign-on, authenticator apps and passkeys." },
  { name: "Proposals and change orders", blurb: "Price work, send it for signature and handle changes." },
  { name: "Invoicing", blurb: "Milestones, sending invoices and tracking what is owed." },
];
