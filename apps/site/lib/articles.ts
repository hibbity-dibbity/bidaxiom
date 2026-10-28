import type { Article } from "./kb";

export const ARTICLES: Article[] = [
  {
    slug: "connect-quickbooks-online",
    title: "Connect QuickBooks Online",
    category: "QuickBooks Online",
    summary: "Authorize BidAxiom to talk to your QuickBooks company, then choose what syncs.",
    intro:
      "Link BidAxiom to your QuickBooks company so invoices and orders post there and bills and payments come back. You need to be a BidAxiom admin and an admin of the QuickBooks company you are linking.",
    minutes: 5,
    steps: [
      {
        title: "Open the QuickBooks settings",
        body: [
          "Sign in to BidAxiom, then go to **Settings** and choose **QuickBooks Online** (it is in the Connections group, visible to admins).",
        ],
        shot: { src: "/kb/settings-home.png", alt: "The Settings home page with the QuickBooks Online and Single sign-on cards", caption: "Settings groups everything admins manage. QuickBooks Online is under Connections." },
      },
      {
        title: "Select Connect QuickBooks",
        body: [
          "On the **QuickBooks Online** card the status shows **Not Connected**. Select **Connect QuickBooks**. You are taken to Intuit's own sign-in page.",
        ],
        shot: { src: "/kb/qbo-settings.png", alt: "The QuickBooks Online card with the connection status and the Connect QuickBooks button", caption: "The card shows the connection status and the button to connect. (Shown here after a connection has expired, so the button reads Reconnect.)" },
      },
      {
        title: "Sign in to Intuit and choose your company",
        body: [
          "Sign in with the Intuit account that administers your books. If you have more than one QuickBooks company, Intuit asks which one to link. Choose the company you do your real bookkeeping in.",
        ],
        tip: "Your password is entered on Intuit's page only. BidAxiom never sees it.",
      },
      {
        title: "Approve the connection",
        body: [
          "Intuit lists what BidAxiom is asking to do. Select **Connect** to approve. You come back to BidAxiom and the card shows **Connected**, with the company name and when it was linked.",
          "If you see **Reconnect QuickBooks** later, the connection expired or was revoked at Intuit. Select it and repeat this step.",
        ],
        shot: { src: "/kb/qbo-connected.png", alt: "The QuickBooks Online card showing the connected company", caption: "Connected: the card shows the company, environment and when the token renews." },
        warn: "If the card says the environment is Sandbox, you are linking a practice QuickBooks company, not your real books. That is the safe way to test.",
      },
      {
        title: "Choose what syncs",
        body: [
          "Turn on the pieces you want on the **Invoices in QuickBooks**, **Purchase and work orders in QuickBooks** and **Automatic sync** cards. Leave **Send invoices to QuickBooks** and **Send orders to QuickBooks** off until your bookkeeper has checked the account and tax mapping on a test.",
          "The next guide walks through those choices.",
        ],
        shot: { src: "/kb/qbo-sync-cards.png", alt: "The Invoices in QuickBooks, Purchase and work orders and Automatic sync cards", caption: "Each card controls one kind of record." },
      },
    ],
    related: ["map-quickbooks-accounts-and-tax-codes", "set-up-single-sign-on"],
  },
  {
    slug: "map-quickbooks-accounts-and-tax-codes",
    title: "Map QuickBooks accounts and tax codes",
    category: "QuickBooks Online",
    summary: "Choose where invoice and order lines post and which sales tax code to use.",
    intro:
      "Once BidAxiom is connected, tell it which QuickBooks items and accounts to use. You do this once, ideally with your bookkeeper, and every invoice and order after that follows the same rules.",
    minutes: 10,
    steps: [
      {
        title: "Open the sync cards",
        body: ["Go to **Settings**, then **QuickBooks Online**, and scroll to the **Invoices in QuickBooks** and **Purchase and work orders in QuickBooks** cards."],
        shot: { src: "/kb/qbo-sync-cards.png", alt: "The QuickBooks sync cards in settings", caption: "Invoices on the first card, orders on the second." },
      },
      {
        title: "Choose where invoice lines post",
        body: [
          "Under **Post invoice lines to**, pick the QuickBooks service item tied to your contract income account. Invoices with no sales tax go out non-taxable.",
        ],
      },
      {
        title: "Choose the sales tax code",
        body: [
          "Pick a code under **Sales tax code (only used when an invoice has sales tax)**. It is applied only to invoices that carry sales tax. If you change the code later, existing QuickBooks invoices are updated to match.",
        ],
        tip: "Ask your bookkeeper which code and tax agency are right for your state before you turn sending on.",
      },
      {
        title: "Choose where order lines post",
        body: [
          "Under **Post order lines to**, pick the QuickBooks account that purchase and work order lines should land in, usually a cost of goods sold account. Vendors are matched by name, or created in QuickBooks if they are new.",
        ],
      },
      {
        title: "Set the start dates",
        body: [
          "**Send invoices sent on or after** and **Send orders issued on or after** keep older paperwork from being sent twice. Set both to the day you start, so nothing already entered in QuickBooks is duplicated.",
        ],
      },
      {
        title: "Turn sending on",
        body: [
          "When your bookkeeper is happy with a test, switch on **Send invoices to QuickBooks** and **Send orders to QuickBooks**. On the **Automatic sync** card, choose **How often** BidAxiom checks, and turn on **Read deposits and payments from QuickBooks** so paid invoices update themselves.",
        ],
        warn: "QuickBooks stays your book of record. Test against the sandbox first, then switch to production keys when you are ready.",
      },
    ],
    related: ["connect-quickbooks-online"],
  },
  {
    slug: "set-up-single-sign-on",
    title: "Set up single sign-on",
    category: "Sign-in and security",
    summary: "Let your team sign in with Microsoft, Google or another OpenID Connect provider.",
    intro:
      "Single sign-on lets people use the account they already have instead of a separate BidAxiom password. This guide uses Microsoft Entra ID; Google Workspace and other OpenID Connect providers follow the same steps. You need to be a BidAxiom admin and an admin of your provider.",
    minutes: 15,
    steps: [
      {
        title: "Open the single sign-on settings",
        body: ["Go to **Settings**, then **Single sign-on**. Step 1 on the page shows the **redirect (callback) address** you will give your provider. Copy it."],
        shot: { src: "/kb/sso-page.png", alt: "The Single sign-on settings page showing the redirect address", caption: "Copy the redirect address from step 1." },
      },
      {
        title: "Register BidAxiom with your provider",
        body: [
          "In your provider's admin area, create an app (a \"web\" or \"OpenID Connect\" app). In Microsoft Entra ID this is an **App registration**. Paste the redirect address as the app's redirect URI.",
          "Create a client secret for the app and copy its value right away; most providers show it only once. Also note the app's **Client ID** and, for Microsoft, the **Directory (tenant) ID** from the Overview page.",
        ],
      },
      {
        title: "Enter the details in BidAxiom",
        body: [
          "In step 2, pick your **Provider**: Microsoft (Entra ID), Google Workspace or Other. Fill in the **Directory (tenant) ID** (Microsoft) or **Issuer URL** (Other, for example `https://yourcompany.okta.com`), then the **Client ID** and **Client secret**, and select **Save**.",
          "The secret is stored encrypted and is never shown again.",
        ],
      },
      {
        title: "Verify your email domain",
        body: [
          "In step 3, add your company's domain, for example `yourcompany.com`. BidAxiom emails a six-digit code to an address at that domain; enter it and select **Verify**.",
          "Sign-in is routed by the part of the email after the @, so only verified domains are sent to your provider.",
        ],
      },
      {
        title: "Test the connection",
        body: [
          "In step 4 select **Test connection**. You sign in through your provider once, which confirms the details and links your own BidAxiom account.",
        ],
        warn: "Changing the provider details turns single sign-on off until you test it again.",
      },
      {
        title: "Choose your options and turn it on",
        body: [
          "After a successful test, set the options and select **Save options**:",
          "**Allow single sign-on** sends people with a matching email to your provider. **Create accounts on first sign-in** lets anyone your provider approves join as the **Role for new accounts**; leave it off to join by invitation only. **Require single sign-on** stops passwords working for members; admins can still use a password so a provider outage cannot lock you out.",
          "The status line under the options tells you in plain words what the sign-in page will do right now. Use **Check an email address** to see how a specific person would be routed.",
        ],
      },
    ],
    related: ["set-up-authenticator-app-and-passkeys", "invite-your-team-and-choose-roles"],
  },
  {
    slug: "set-up-authenticator-app-and-passkeys",
    title: "Set up an authenticator app and passkeys",
    category: "Sign-in and security",
    summary: "Add a second step to your sign-in and use a passkey instead of typing a password.",
    intro:
      "BidAxiom protects accounts with a password plus a second factor. You can use an authenticator app on your phone, a passkey on your phone or laptop, or both.",
    minutes: 5,
    steps: [
      {
        title: "Open your account settings",
        body: ["Select **Settings**, then **Profile and sign-in**. The **Authenticator app** and **Passkeys** cards are on this page."],
        shot: { src: "/kb/account-security.png", alt: "Profile and sign-in settings with the authenticator app and passkeys cards", caption: "Your sign-in options live on Profile and sign-in." },
      },
      {
        title: "Set up the authenticator app",
        body: [
          "On the **Authenticator app** card, start setup and scan the QR code with an authenticator app such as Microsoft Authenticator, Google Authenticator or 1Password. Enter the six-digit code it shows to finish.",
          "Save the backup codes you are given somewhere safe. They let you in if you lose your phone.",
        ],
      },
      {
        title: "Add a passkey",
        body: [
          "On the **Passkeys** card, add a passkey and give it a name you will recognize, for example Work laptop. Your device asks you to confirm with a fingerprint, face or PIN.",
          "Passkeys can then be used to sign in without typing the password, and you can add more than one (a phone and a laptop, say).",
        ],
        tip: "If you get a new phone, add a passkey on the new one before you get rid of the old one.",
      },
      {
        title: "Change your password",
        body: ["Use **Change Password** on the same page. A new password needs an uppercase letter, a lowercase letter and a number."],
      },
      {
        title: "If you are locked out",
        body: ["Ask a BidAxiom admin in your company to contact support. A sign-in reset clears your old factors and emails you a link to choose a new password, and then you set up your authenticator and passkeys again."],
      },
    ],
    related: ["set-up-single-sign-on", "invite-your-team-and-choose-roles"],
  },
  {
    slug: "invite-your-team-and-choose-roles",
    title: "Invite your team and choose roles",
    category: "Getting started",
    summary: "Add people to your company and give each one the right role.",
    intro:
      "Everyone works in your company under their own sign-in, and a role decides what they can see and do. Only admins can invite people.",
    minutes: 3,
    steps: [
      {
        title: "Open Team members",
        body: ["Go to **Settings**, then **Team members**. You see everyone in the company with their **Role**, when they **Joined**, and an **Actions** column."],
        shot: { src: "/kb/members.png", alt: "The Team members page listing people, roles and pending invitations", caption: "Members and pending invitations in one place." },
      },
      {
        title: "Enter an email and pick a role",
        body: [
          "In the invite form, type the person's email, choose a role and select **Invite**. The roles are **Admin**, **Project Manager**, **Accountant**, **Estimator**, **Superintendent**, **Foreman** and **Member**. New invitations default to **Member**.",
          "Money screens such as invoices, margins and the full dashboard are limited to the roles that need them (admins, project managers and accountants). Project managers can switch the dashboard to **My projects** to see only their own jobs.",
        ],
        shot: { src: "/kb/members-invite.png", alt: "The invite form with an email box, a role menu and the Invite button", caption: "Choose the role before you invite." },
      },
      {
        title: "Follow up on pending invitations",
        body: [
          "Until someone accepts, they appear under **Pending Invitations** with an expiry date. Use **Resend** if the email got lost, or **Revoke** to cancel it.",
          "When they accept, they choose a password and then set up an authenticator app or passkey.",
        ],
      },
      {
        title: "Change a role or remove someone",
        body: ["Use the **Actions** menu beside a person to change their role or remove them. Changes take effect the next time their session refreshes."],
        tip: "Give people the smallest role that lets them do their job. You can always raise it later.",
      },
    ],
    related: ["set-up-authenticator-app-and-passkeys", "set-up-single-sign-on"],
  },
  {
    slug: "build-and-send-a-proposal",
    title: "Build and send a proposal",
    category: "Proposals and change orders",
    summary: "Price a job with cost lines, margin, options and tax, then send it for e-signature.",
    intro:
      "A BidAxiom proposal is built from the costs behind the price, so you see your margin as you work. When the customer signs, the proposal becomes the contract and your invoices are created for you.",
    minutes: 15,
    steps: [
      {
        title: "Open the proposal on a project",
        body: ["Open the project and select the **Proposals** tab. The builder opens on the active proposal. Set **Valid for** to the number of days the price holds."],
      },
      {
        title: "Add parent lines and child lines",
        body: [
          "Use **+ Add parent line** for each scope of work, for example Foundation and slab or Roofing. Under each one, **+ Add child line** adds the cost items that make it up. Each child line has a **Type** (such as Material or Subcontractor), an optional **Vendor**, a **Qty**, a **Unit** and a **Unit cost**.",
          "**+ Add from template** drops in a saved group of lines, so you do not retype the jobs you price often.",
        ],
        shot: { src: "/kb/proposal-builder.png", alt: "The proposal builder with parent lines, child lines and the totals box", caption: "Parent lines hold the child lines that make up your cost." },
      },
      {
        title: "Set your margin and sales tax",
        body: [
          "On the right, **Margin on all lines (%)** sets your markup; select **Apply to all** to use it everywhere, or change a single line to override it. **Sales tax on material lines (%)** applies tax to material lines only.",
          "The box at the top shows **Cost**, **Contingency**, **Profit** with your margin, **Global costs**, **Sales tax** and the **Proposal total**, updated as you type.",
        ],
      },
      {
        title: "Add global costs and optional items",
        body: [
          "**+ Global cost** adds project-wide costs such as permits and fees. They are shared across the parent lines in proportion to each line's cost and included in the price.",
          "**+ Add optional item** adds work the customer can choose. Optional items are listed separately and are not in the proposal total until the customer accepts them. **+ Add-on** attaches an optional extra to a specific parent line.",
        ],
      },
      {
        title: "Plan the invoicing schedule",
        body: [
          "Under **Invoicing schedule**, add a **+ Milestone** for each bill, for example Mobilization, Slab poured, Dried in and Final. Choose **By total** to split the contract by percentage or **By line** to bill against specific lines. The box turns green and reads **Schedule totals 100%** when the schedule adds up.",
          "Set **Payment terms**, for example Net 30, under Adjustments.",
        ],
      },
      {
        title: "Preview, then send for signature",
        body: [
          "Select **Preview** to see the customer's version, or **Download PDF**. When you are ready, select **Email**.",
          "In **Send to customer**, check **To**, **CC**, **Subject** and **Message**, and keep **Include a link to review and sign online** ticked. Select **Send email**.",
        ],
        shot: { src: "/kb/proposal-send.png", alt: "The Send to customer dialog for a proposal", caption: "The customer receives a link to review, choose options and sign." },
      },
      {
        title: "What happens when the customer signs",
        body: [
          "The customer reviews the proposal, picks any optional items and signs online. The proposal is accepted automatically, a signed PDF is filed in the project's **Documents**, and a draft invoice is created for each milestone.",
        ],
        tip: "Need to change the scope after signing? Use a change order instead of editing the signed proposal. See the invoicing guide for how change orders bill.",
      },
    ],
    related: ["invoice-a-project-by-milestone", "map-quickbooks-accounts-and-tax-codes"],
  },
  {
    slug: "invoice-a-project-by-milestone",
    title: "Invoice a project by milestone",
    category: "Invoicing",
    summary: "Send milestone invoices, record payments and keep track of what is owed.",
    intro:
      "When a proposal is accepted, BidAxiom creates one draft invoice per milestone from your invoicing schedule. You decide when each one goes out.",
    minutes: 8,
    steps: [
      {
        title: "Open the project's Invoices tab",
        body: ["Open the project and select **Invoices**. Each milestone from the signed proposal is listed with its amount and a status chip: **Draft**, **Overdue** or **Paid**."],
        shot: { src: "/kb/project-invoices.png", alt: "A project's Invoices tab with milestone invoices and status chips", caption: "One draft invoice per milestone, ready when you are." },
      },
      {
        title: "Send an invoice when the milestone is reached",
        body: [
          "Drafts are never sent automatically. When a milestone is complete, use the row's send action (email the invoice to the customer) so the invoice moves from **Draft** to open. You can also view or download the PDF from the same row.",
        ],
      },
      {
        title: "Combine invoices if you need to",
        body: ["Tick two or more unsent invoices and select **Merge selected** to bill them together as one."],
      },
      {
        title: "Record payments",
        body: [
          "When money comes in, use **record payment** on the row, or mark the invoice paid. If QuickBooks is connected and **Read deposits and payments from QuickBooks** is on, payments entered in QuickBooks update BidAxiom on their own.",
        ],
      },
      {
        title: "See everything that is owed",
        body: [
          "The **Invoices** page in the sidebar lists every invoice across all projects. Use the **All**, **Draft**, **Open**, **Overdue** and **Paid** tabs, and the search box to find one. The dashboard's receivables chart shows what is owed by age.",
        ],
        shot: { src: "/kb/invoices-list.png", alt: "The Invoices page with a search box and a status filter", caption: "All invoices across projects, searchable and filtered by status." },
      },
      {
        title: "Bill extra work with change orders",
        body: [
          "On the project's **Change Orders** tab, select **New change order** to price extra work. A change order needs an accepted proposal first. Once the customer approves it, it adds its own invoice, and a deductive change order adds a credit invoice, so the contract value and what is left to bill stay correct.",
        ],
      },
    ],
    related: ["build-and-send-a-proposal", "connect-quickbooks-online"],
  },
];
