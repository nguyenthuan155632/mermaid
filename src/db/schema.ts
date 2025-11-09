import { pgTable, text, timestamp, uuid, integer, boolean, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const diagrams = pgTable(
  "diagrams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    code: text("code").notNull(),
    description: text("description"),
    isPublic: boolean("is_public").default(false).notNull(),
    shareToken: text("share_token").unique(),
    exportToken: text("export_token").unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("diagrams_user_id_idx").on(table.userId),
    shareTokenIdx: index("diagrams_share_token_idx").on(table.shareToken),
    exportTokenIdx: index("diagrams_export_token_idx").on(table.exportToken),
  })
);

export const sampleDiagrams = pgTable(
  "sample_diagrams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    code: text("code").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    order: integer("order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    categoryIdx: index("sample_diagrams_category_idx").on(table.category),
    orderIdx: index("sample_diagrams_order_idx").on(table.order),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Diagram = typeof diagrams.$inferSelect;
export type NewDiagram = typeof diagrams.$inferInsert;
export type SampleDiagram = typeof sampleDiagrams.$inferSelect;
export type NewSampleDiagram = typeof sampleDiagrams.$inferInsert;

