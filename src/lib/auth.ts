import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";

export async function getServerAuthSession() {
  return await getServerSession(authOptions);
}
