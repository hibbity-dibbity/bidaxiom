import SignInForm from "./sign-in-form";

export default function SignInPage({
  searchParams,
}: {
  searchParams: { redirect_url?: string };
}) {
  const redirectUrl = searchParams.redirect_url ?? "/";
  return <SignInForm redirectUrl={redirectUrl} />;
}
