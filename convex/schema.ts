import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(v.union(v.literal("SUAMI"), v.literal("ISTRI"))),
    householdId: v.optional(v.id("households")),
    familyName: v.optional(v.string()),
    joinCode: v.optional(v.string()),
    chartRange: v.optional(v.union(v.literal("7"), v.literal("30"), v.literal("all"))),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_household", ["householdId"]),
  households: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    ownerId: v.optional(v.id("users")),
    createdAt: v.number(),
    legacySource: v.optional(v.string()),
    legacyBookId: v.optional(v.string()),
    legacyData: v.optional(v.any()),
  })
    .index("by_invite_code", ["inviteCode"])
    .index("by_legacy_book_id", ["legacyBookId"]),
  transactions: defineTable({
    householdId: v.id("households"),
    ownerUserId: v.optional(v.id("users")),
    ownerRole: v.union(v.literal("SUAMI"), v.literal("ISTRI")),
    date: v.string(),
    description: v.string(),
    amount: v.number(),
    balance: v.optional(v.number()),
    category: v.string(),
    fingerprint: v.string(),
    createdAt: v.number(),
  })
    .index("by_household_date", ["householdId", "date"])
    .index("by_household_fingerprint", ["householdId", "fingerprint"]),
});

