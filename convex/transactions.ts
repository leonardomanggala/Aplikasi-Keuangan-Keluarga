import { v } from "convex/values";
import { mutationGeneric as mutation, queryGeneric as query } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";

async function currentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Silakan masuk terlebih dahulu.");
  const userId = await getAuthUserId(ctx);
  let user = userId ? await ctx.db.get(userId) : null;
  if (!user && identity.email) {
    user = await ctx.db.query("users").withIndex("email", (q: any) => q.eq("email", identity.email.trim().toLowerCase())).unique();
  }
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
    const members = await ctx.db.query("users").withIndex("by_household", (q: any) => q.eq("householdId", user.householdId)).collect();
    let added = 0;
    let skipped = 0;
    let corrected = 0;
    for (const transaction of args.transactions) {
      const fingerprint = `${transaction.date}_${transaction.amount}_${transaction.description.trim().toLowerCase()}`;
      const duplicate = await ctx.db.query("transactions").withIndex("by_household_fingerprint", (q: any) => q.eq("householdId", user.householdId).eq("fingerprint", fingerprint)).first();
      if (duplicate) {
        if (duplicate.ownerRole !== transaction.ownerRole) {
          const owner = members.find(member => member.role === transaction.ownerRole);
          await ctx.db.patch(duplicate._id, { ownerRole: transaction.ownerRole, ...(owner ? { ownerUserId: owner._id } : {}) });
          corrected++;
        }
        skipped++;
        continue;
      }
      const owner = members.find(member => member.role === transaction.ownerRole);
      await ctx.db.insert("transactions", { ...transaction, householdId: user.householdId!, ownerUserId: owner?._id ?? user._id, fingerprint, createdAt: Date.now() });
      added++;
    }
    return { added, skipped, corrected };
  },
});

export const clearHouseholdTransactions = mutation({
  args: { confirmation: v.literal("DELETE_TRANSACTIONS") },
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    const transactions = await ctx.db.query("transactions").withIndex("by_household_date", (q: any) => q.eq("householdId", user.householdId)).collect();
    for (const transaction of transactions) await ctx.db.delete(transaction._id);
    const household = await ctx.db.get(user.householdId!);
    if (household) await ctx.db.patch(household._id, { legacyData: { opening: 0 } });
    return { deleted: transactions.length };
  },
});

