import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

const FamilyPassword = Password({
  profile(params) {
    return {
      email: String(params.email).trim().toLowerCase(),
      name: String(params.name || "Pengguna DanaKeluarga").trim(),
      role: params.role === "ISTRI" ? "ISTRI" : "SUAMI",
      familyName: params.familyName ? String(params.familyName).trim() : undefined,
      joinCode: params.joinCode ? String(params.joinCode).trim().toUpperCase() : undefined,
    };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [FamilyPassword],
});

