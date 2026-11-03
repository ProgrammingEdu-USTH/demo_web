-- CreateTable
CREATE TABLE "playground_snippets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "language" VARCHAR(16) NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "playground_snippets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "playground_snippets_user_id_updated_at_idx" ON "playground_snippets"("user_id", "updated_at" DESC);

-- AddForeignKey
ALTER TABLE "playground_snippets" ADD CONSTRAINT "playground_snippets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
