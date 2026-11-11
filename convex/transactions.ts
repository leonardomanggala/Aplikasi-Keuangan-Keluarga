import { v } from "convex/values";
import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";

async function currentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.email) throw new Error("Silakan masuk terlebih dahulu.");
  const user = await ctx.db.query("users").withIndex("email", (q: any) => q.eq("email", identity.email)).unique();
  if (!user?.householdId) throw new Error("Gabung atau buat rumah tangga terlebih dahulu.");
  return user;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    return await ctx.db.query("transactions").withIndex("by_household_date", (q: any) => q.eq("householdId", user.householdId)).order("desc").collect();
  },
});

export const addMany = mutation({
  args: {
    transactions: v.array(v.object({
      ownerRole: v.union(v.literal("SUAMI"), v.literal("ISTRI")),
      date: v.string(), description: v.string(), amount: v.number(), balance: v.optional(v.number()), category: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const user = await currentUser(ctx);
    let added = 0;
    let skipped = 0;
    for (const transaction of args.transactions) {
      const fingerprint = `${transaction.date}_${transaction.amount}_${transaction.description.trim().toLowerCase()}`;
      const duplicate = await ctx.db.query("transactions").withIndex("by_household_fingerprint", (q: any) => q.eq("householdId", user.householdId).eq("fingerprint", fingerprint)).first();
      if (duplicate) { skipped++; continue; }
      await ctx.db.insert("transactions", { ...transaction, householdId: user.householdId!, ownerUserId: user._id, fingerprint, createdAt: Date.now() });
      added++;
    }
    return { added, skipped };
  },
});

