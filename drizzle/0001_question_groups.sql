-- Question groups: a case, an EMQ or a true/false block.
-- Purely additive: nothing is dropped or rewritten, and every existing question keeps working
-- because group_id stays null for all of them.

CREATE TABLE IF NOT EXISTS "question_groups" (
  "id" text PRIMARY KEY NOT NULL,
  "topic_id" text NOT NULL,
  "kind" text NOT NULL,
  "title" text DEFAULT '' NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "order" integer DEFAULT 0 NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "question_groups"
    ADD CONSTRAINT "question_groups_topic_id_topics_id_fk"
    FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "qg_topic_idx" ON "question_groups" USING btree ("topic_id");

ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "group_id" text;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "group_order" integer DEFAULT 0 NOT NULL;

DO $$ BEGIN
  ALTER TABLE "questions"
    ADD CONSTRAINT "questions_group_id_question_groups_id_fk"
    FOREIGN KEY ("group_id") REFERENCES "public"."question_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "questions_group_idx" ON "questions" USING btree ("group_id");
