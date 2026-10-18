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
        shot: { src: "/kb/qbo-settings.png", alt: "The QuickBooks Online card with the Connect QuickBooks button", caption: "The card shows the connection status and the Connect QuickBooks button." },
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
];
