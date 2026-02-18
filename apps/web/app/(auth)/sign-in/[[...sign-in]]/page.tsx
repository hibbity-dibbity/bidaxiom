import SignInForm from "./sign-in-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function SignInPage({
  searchParams,
}: {
  searchParams: { redirect_url?: string };
}) {
  const redirectUrl = searchParams.redirect_url ?? "/";
  return <SignInForm redirectUrl={redirectUrl} />;
}
