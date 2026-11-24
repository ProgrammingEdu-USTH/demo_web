
-- CreateTable
CREATE TABLE "arena_quiz_matches" (
    "id" SERIAL NOT NULL,
    "status" "arena_match_status" NOT NULL DEFAULT 'waiting',
    "host_id" INTEGER NOT NULL,
    "guest_id" INTEGER,
    "winner_id" INTEGER,
    "questions" JSONB NOT NULL,
    "end_reason" VARCHAR(16),
    "unscored" BOOLEAN NOT NULL DEFAULT false,
    "host_score" INTEGER NOT NULL DEFAULT 0,
    "guest_score" INTEGER NOT NULL DEFAULT 0,
    "host_rating_delta" INTEGER,
    "guest_rating_delta" INTEGER,
    "host_xp" INTEGER,
    "guest_xp" INTEGER,
    "host_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "arena_quiz_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_quiz_answers" (
    "id" SERIAL NOT NULL,
    "match_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "q_index" SMALLINT NOT NULL,
    "choice" SMALLINT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arena_quiz_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arena_quiz_ratings" (
    "user_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "arena_quiz_ratings_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "arena_quiz_matches_status_created_at_idx" ON "arena_quiz_matches"("status", "created_at");

-- CreateIndex
CREATE INDEX "arena_quiz_matches_host_id_status_idx" ON "arena_quiz_matches"("host_id", "status");

-- CreateIndex
CREATE INDEX "arena_quiz_matches_guest_id_status_idx" ON "arena_quiz_matches"("guest_id", "status");

-- CreateIndex
CREATE INDEX "arena_quiz_answers_user_id_idx" ON "arena_quiz_answers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "arena_quiz_answers_match_id_user_id_q_index_key" ON "arena_quiz_answers"("match_id", "user_id", "q_index");

-- CreateIndex
CREATE INDEX "arena_quiz_ratings_rating_idx" ON "arena_quiz_ratings"("rating" DESC);

-- AddForeignKey
ALTER TABLE "arena_quiz_matches" ADD CONSTRAINT "arena_quiz_matches_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_quiz_matches" ADD CONSTRAINT "arena_quiz_matches_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_quiz_matches" ADD CONSTRAINT "arena_quiz_matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_quiz_answers" ADD CONSTRAINT "arena_quiz_answers_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "arena_quiz_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_quiz_answers" ADD CONSTRAINT "arena_quiz_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arena_quiz_ratings" ADD CONSTRAINT "arena_quiz_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
