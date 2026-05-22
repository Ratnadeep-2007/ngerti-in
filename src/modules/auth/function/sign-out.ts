import { authClient } from "@/lib/auth-client";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export const onLogout = (router: AppRouterInstance) => {
  authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        router.push("/sign-in");
      },
    },
  });
};
