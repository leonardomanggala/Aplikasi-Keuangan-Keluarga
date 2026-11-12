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
      await ctx.db.insert("transactions", { ...transaction, householdId: user.householdId!, ownerUserId: user._id, fingerprint, createdAt: Date.now() });
      added++;
    }
    return { added, skipped, corrected };
  },
});

export const correctIncomingTransferOwners = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    const members = await ctx.db.query("users").withIndex("by_household", (q: any) => q.eq("householdId", user.householdId)).collect();
    const transactions = await ctx.db.query("transactions").withIndex("by_household_date", (q: any) => q.eq("householdId", user.householdId)).collect();
    let corrected = 0;
    for (const transaction of transactions) {
      const incomingTransfer = /\b(dari|from)\b/i.test(transaction.description) && /transfer|setoran|kirim|incoming/i.test(transaction.description);
      if (!incomingTransfer) continue;
      const normalizedDescription = transaction.description.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const matchingMember = members
        .filter(member => member.role === "SUAMI" || member.role === "ISTRI")
        .map(member => {
          const parts = String(member.name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z]+/g) || [];
          const significantParts = parts.filter(part => part.length > 1 && !["bpk", "ibu", "pak", "bu", "mr", "mrs", "suami", "istri"].includes(part));
          return { member, significantParts };
        })
        .filter(candidate => candidate.significantParts.length >= 2 && candidate.significantParts.every(part => normalizedDescription.includes(part)))
        .sort((a, b) => b.significantParts.length - a.significantParts.length)[0]?.member;
      if (matchingMember && transaction.ownerRole !== matchingMember.role) {
        await ctx.db.patch(transaction._id, { ownerRole: matchingMember.role, ownerUserId: matchingMember._id });
        corrected++;
      }
    }
    return { corrected };
  },
});

