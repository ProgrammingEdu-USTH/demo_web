-- CreateEnum
CREATE TYPE "arena_match_status" AS ENUM ('waiting', 'active', 'finished', 'cancelled');

-- CreateEnum
CREATE TYPE "arena_end_reason" AS ENUM ('solved', 'timeout', 'forfeit');

-- CreateEnum
CREATE TYPE "arena_submission_status" AS ENUM ('graded', 'rejected', 'error');

-- CreateTable
CREATE TABLE "arena_matches" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "status" "arena_match_status" NOT NULL DEFAULT 'waiting',
    "problem_id" VARCHAR(64) NOT NULL,
    "host_id" INTEGER NOT NULL,
    "guest_id" INTEGER,
    "winner_id" INTEGER,
    "end_reason" "arena_end_reason",
    "host_rating_delta" INTEGER,
    "guest_rating_delta" INTEGER,
    "host_xp" INTEGER,
    "guest_xp" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "deadline_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "arena_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_submissions" (
    "id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "status" "arena_submission_status" NOT NULL,
    "passed" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "detail" JSONB,
    "message" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "graded_at" TIMESTAMPTZ(6),

    CONSTRAINT "arena_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_ratings" (
    "user_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "arena_ratings_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "arena_matches_code_key" ON "arena_matches"("code");

-- CreateIndex
CREATE INDEX "arena_matches_status_is_public_created_at_idx" ON "arena_matches"("status", "is_public", "created_at");

-- CreateIndex
CREATE INDEX "arena_matches_host_id_status_idx" ON "arena_matches"("host_id", "status");

-- CreateIndex
CREATE INDEX "arena_matches_guest_id_status_idx" ON "arena_matches"("guest_id", "status");

-- CreateIndex
CREATE INDEX "arena_submissions_match_id_user_id_created_at_idx" ON "arena_submissions"("match_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "arena_ratings_rating_idx" ON "arena_ratings"("rating" DESC);

-- AddForeignKey
ALTER TABLE "arena_matches" ADD CONSTRAINT "arena_matches_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_matches" ADD CONSTRAINT "arena_matches_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_matches" ADD CONSTRAINT "arena_matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_submissions" ADD CONSTRAINT "arena_submissions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "arena_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_submissions" ADD CONSTRAINT "arena_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_ratings" ADD CONSTRAINT "arena_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

