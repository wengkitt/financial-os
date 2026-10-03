CREATE TABLE "adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"amount" numeric(24, 8) NOT NULL,
	"date" date NOT NULL,
	"notes" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_throttles" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"month" text NOT NULL,
	"amount" numeric(24, 8) NOT NULL,
	CONSTRAINT "budgets_user_id_category_id_month_unique" UNIQUE("user_id","category_id","month"),
	CONSTRAINT "budget_positive" CHECK ("budgets"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "categories_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "categories_user_id_name_kind_unique" UNIQUE("user_id","name","kind")
);
--> statement-breakpoint
CREATE TABLE "occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recurring_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"status" text NOT NULL,
	"transaction_id" uuid,
	CONSTRAINT "occurrences_recurring_id_due_date_unique" UNIQUE("recurring_id","due_date")
);
--> statement-breakpoint
CREATE TABLE "recurring" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"wallet_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"space_id" uuid NOT NULL,
	"amount" numeric(24, 8) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"paused" boolean DEFAULT false NOT NULL,
	CONSTRAINT "recurring_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "recurring_valid" CHECK ("recurring"."amount" > 0 AND ("recurring"."end_date" IS NULL OR "recurring"."end_date" >= "recurring"."start_date"))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"start_date" date,
	"end_date" date,
	"budget" numeric(24, 8),
	"status" text DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	CONSTRAINT "spaces_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "space_date_order" CHECK ("spaces"."end_date" IS NULL OR "spaces"."start_date" IS NULL OR "spaces"."end_date" >= "spaces"."start_date")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"space_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" numeric(24, 8) NOT NULL,
	"exchange_rate" numeric(24, 8) NOT NULL,
	"reporting_amount" numeric(24, 8) NOT NULL,
	"date" date NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"preparation" boolean DEFAULT false NOT NULL,
	CONSTRAINT "transactions_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "transaction_amount_positive" CHECK ("transactions"."amount" > 0 AND "transactions"."exchange_rate" > 0),
	CONSTRAINT "transaction_preparation_expense" CHECK (NOT "transactions"."preparation" OR "transactions"."kind" = 'expense')
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"from_wallet_id" uuid NOT NULL,
	"to_wallet_id" uuid NOT NULL,
	"sent_amount" numeric(24, 8) NOT NULL,
	"received_amount" numeric(24, 8) NOT NULL,
	"date" date NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	CONSTRAINT "transfer_valid" CHECK ("transfers"."from_wallet_id" <> "transfers"."to_wallet_id" AND "transfers"."sent_amount" > 0 AND "transfers"."received_amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"verified_at" timestamp with time zone,
	"reporting_currency" text DEFAULT 'MYR' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kuala_Lumpur' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"currency" text NOT NULL,
	"opening_balance" numeric(24, 8) NOT NULL,
	"exchange_rate" numeric(24, 8) NOT NULL,
	"opening_reporting" numeric(24, 8) NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "wallets_id_user_id_unique" UNIQUE("id","user_id"),
	CONSTRAINT "wallet_opening_nonnegative" CHECK ("wallets"."opening_balance" >= 0 AND "wallets"."exchange_rate" > 0)
);
--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_wallet_id_user_id_wallets_id_user_id_fk" FOREIGN KEY ("wallet_id","user_id") REFERENCES "public"."wallets"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_user_id_categories_id_user_id_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."categories"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_recurring_id_user_id_recurring_id_user_id_fk" FOREIGN KEY ("recurring_id","user_id") REFERENCES "public"."recurring"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_transaction_id_user_id_transactions_id_user_id_fk" FOREIGN KEY ("transaction_id","user_id") REFERENCES "public"."transactions"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring" ADD CONSTRAINT "recurring_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring" ADD CONSTRAINT "recurring_wallet_id_user_id_wallets_id_user_id_fk" FOREIGN KEY ("wallet_id","user_id") REFERENCES "public"."wallets"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring" ADD CONSTRAINT "recurring_category_id_user_id_categories_id_user_id_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."categories"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring" ADD CONSTRAINT "recurring_space_id_user_id_spaces_id_user_id_fk" FOREIGN KEY ("space_id","user_id") REFERENCES "public"."spaces"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_user_id_wallets_id_user_id_fk" FOREIGN KEY ("wallet_id","user_id") REFERENCES "public"."wallets"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_user_id_categories_id_user_id_fk" FOREIGN KEY ("category_id","user_id") REFERENCES "public"."categories"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_space_id_user_id_spaces_id_user_id_fk" FOREIGN KEY ("space_id","user_id") REFERENCES "public"."spaces"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_wallet_id_user_id_wallets_id_user_id_fk" FOREIGN KEY ("from_wallet_id","user_id") REFERENCES "public"."wallets"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_wallet_id_user_id_wallets_id_user_id_fk" FOREIGN KEY ("to_wallet_id","user_id") REFERENCES "public"."wallets"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_user_id_date_index" ON "transactions" USING btree ("user_id","date");