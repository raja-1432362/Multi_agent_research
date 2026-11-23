import mongoose from "mongoose";
import { env } from "./config/env";
import { createApp } from "./app";
import { ResearchRun, TERMINAL } from "./models";

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("MongoDB connected");

  // Free hosts restart often. Mark interrupted runs so users can see and retry them.
  const res = await ResearchRun.updateMany(
    { status: { $nin: TERMINAL } },
    { status: "failed", error: "The server restarted while this run was in progress. Use Retry.", completedAt: new Date() }
  );
  if (res.modifiedCount) console.log(`Marked ${res.modifiedCount} interrupted run(s) as failed`);

  createApp().listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`));
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
