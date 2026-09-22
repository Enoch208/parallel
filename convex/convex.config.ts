import { defineApp } from "convex/server";
import { v } from "convex/values";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import firecrawl from "@firecrawl/firecrawl-convex/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import actionRetrier from "@convex-dev/action-retrier/convex.config";

const app = defineApp({
  httpPrefix: "/api",
  env: { FIRECRAWL_API_KEY: v.string() },
});

app.use(staticHosting, { httpPrefix: "/" });
app.use(workflow);
app.use(workpool, { name: "scoringPool" });
app.use(firecrawl, { env: { FIRECRAWL_API_KEY: app.env.FIRECRAWL_API_KEY } });
app.use(rateLimiter);
app.use(actionRetrier);

export default app;
