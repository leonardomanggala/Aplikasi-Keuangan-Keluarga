import { v } from "convex/values";
import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";

async function signedInUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.email) throw new Error("Silakan masuk terlebih dahulu.");
  const user = await ctx.db.query("users").withIndex("email", (q: any) => q.eq("email", identity.email)).unique();
  if (!user) throw new Error("Profil pengguna tidak ditemukan.");
  return user;
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const user = await signedInUser(ctx);
    if (!user.householdId) return { user, household: null, members: [] };
    const household = await ctx.db.get(user.householdId);
    const members = await ctx.db.query("users").withIndex("by_household", (q: any) => q.eq("householdId", user.householdId)).collect();
    return { user, household, members: members.map(({ _id, name, email, role }) => ({ _id, name, email, role })) };
  },
});

export const createOrJoin = mutation({
  args: { familyName: v.string(), joinCode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await signedInUser(ctx);
    if (user.householdId) return user.householdId;
    let household;
    if (args.joinCode?.trim()) {
      household = await ctx.db.query("households").withIndex("by_invite_code", (q: any) => q.eq("inviteCode", args.joinCode!.trim().toUpperCase())).unique();
      if (!household) throw new Error("Kode undangan tidak ditemukan.");
    } else {
      if (!args.familyName.trim()) throw new Error("Isi nama rumah tangga atau gunakan kode undangan.");
      const inviteCode = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
      const householdId = await ctx.db.insert("households", { name: args.familyName.trim(), inviteCode, ownerId: user._id, createdAt: Date.now() });
      household = await ctx.db.get(householdId);
    }
    if (!household!.ownerId) await ctx.db.patch(household!._id, { ownerId: user._id });
    await ctx.db.patch(user._id, { householdId: household!._id, familyName: household!.name, joinCode: undefined });
    return household!._id;
  },
});

export const updateFamilyName = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await signedInUser(ctx);
    if (!user.householdId) throw new Error("Profil keluarga belum disiapkan.");
    await ctx.db.patch(user.householdId, { name: args.name.trim() });
    return args.name.trim();
  },
});

export const updateProfileName = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await signedInUser(ctx);
    await ctx.db.patch(user._id, { name: args.name.trim() });
  },
});

export const updateChartRange = mutation({
  args: { range: v.union(v.literal("7"), v.literal("30"), v.literal("all")) },
  handler: async (ctx, args) => {
    const user = await signedInUser(ctx);
    await ctx.db.patch(user._id, { chartRange: args.range });
    return args.range;
  },
});

