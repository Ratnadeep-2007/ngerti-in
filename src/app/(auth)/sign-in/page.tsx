import React from "react";
import { headers } from "next/headers";
import { auth, getSessionCore } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignInView from "@/modules/auth/ui/views/sign-in-view";
const Page = async () => {
  const session = await getSessionCore(await headers());

  if (!!session) {
    redirect("/dashboard");
  }

  return (
    <>
      <SignInView />
    </>
  );
};

export default Page;
