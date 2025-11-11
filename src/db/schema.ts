import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  index,
  customType,
  real,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password"),
  googleId: text("google_id").unique(),
  name: text("name"),
  image: text("image"),
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
    anonymousMode: boolean("anonymous_mode").default(false).notNull(),
    shareToken: text("share_token").unique(),
    exportToken: text("export_token").unique(),
    exportCodeHash: text("export_code_hash"),
    pngBlob: bytea("png_blob"),
    pngBackground: text("png_background"),
    pngScale: integer("png_scale"),
    pngGeneratedAt: timestamp("png_generated_at"),
    svgBlob: bytea("svg_blob"),
    svgBackground: text("svg_background"),
    svgGeneratedAt: timestamp("svg_generated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("diagrams_user_id_idx").on(table.userId),
    shareTokenIdx: index("diagrams_share_token_idx").on(table.shareToken),
    exportTokenIdx: index("diagrams_export_token_idx").on(table.exportToken),
  })
);

export const diagramSnapshots = pgTable(
  "diagram_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    diagramId: uuid("diagram_id")
      .notNull()
      .references(() => diagrams.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    code: text("code").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    diagramIdIdx: index("diagram_snapshots_diagram_id_idx").on(table.diagramId),
    createdAtIdx: index("diagram_snapshots_created_at_idx").on(table.createdAt),
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
export type DiagramSnapshot = typeof diagramSnapshots.$inferSelect;
export type NewDiagramSnapshot = typeof diagramSnapshots.$inferInsert;
export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  diagramId: uuid("diagram_id")
    .notNull()
    .references(() => diagrams.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" }),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  anonymousSessionId: uuid("anonymous_session_id"),
  parentId: uuid("parent_id"),
  content: text("content").notNull(),
  positionX: real("position_x").notNull(),
  positionY: real("position_y").notNull(),
  isResolved: boolean("is_resolved").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  diagramIdIdx: index("comments_diagram_id_idx").on(table.diagramId),
  userIdIdx: index("comments_user_id_idx").on(table.userId),
  parentIdIdx: index("comments_parent_id_idx").on(table.parentId),
}));

export type SampleDiagram = typeof sampleDiagrams.$inferSelect;
export type NewSampleDiagram = typeof sampleDiagrams.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

export const diagramSessions = pgTable("diagram_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  diagramId: uuid("diagram_id")
    .notNull()
    .references(() => diagrams.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  socketId: text("socket_id").notNull(),
  cursorPosition: text("cursor_position"), // JSON string with line, column info
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  diagramIdIdx: index("diagram_sessions_diagram_id_idx").on(table.diagramId),
  userIdIdx: index("diagram_sessions_user_id_idx").on(table.userId),
  socketIdIdx: index("diagram_sessions_socket_id_idx").on(table.socketId),
}));

export type DiagramSession = typeof diagramSessions.$inferSelect;
export type NewDiagramSession = typeof diagramSessions.$inferInsert;
