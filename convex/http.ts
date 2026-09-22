import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { verifySvixSignature } from "./model/svix";
import { readEventId, readEventType, readInboundMessage } from "./model/webhookPayload";
import { readMonitoredUrl } from "./model/monitorPayload";
import { hashJudgeToken, judgeTokenIn, redactJudgeToken } from "./model/judgeToken";

const http = httpRouter();

http.route({
  path: "/webhooks/agentmail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;

    if (secret === undefined || secret.length === 0) {
      return new Response("Webhook secret is not configured", { status: 500 });
    }

    const body = await request.text();
    const verified = await verifySvixSignature(
      body,
      {
        id: request.headers.get("svix-id"),
        timestamp: request.headers.get("svix-timestamp"),
        signature: request.headers.get("svix-signature"),
      },
      secret,
      Date.now(),
    );

    if (!verified) {
      return new Response("Invalid signature", { status: 401 });
    }

    const payload: unknown = JSON.parse(body);
    const message = readInboundMessage(payload);
    const kind = readEventType(payload);

    if (message === null) {
      return Response.json({ ok: true, stored: false, reason: "no_message_in_payload" });
    }

    const providerEventId = readEventId(payload, message.messageId ?? body.slice(0, 64));

    const judgeToken = judgeTokenIn(message.subject);

    const result = await ctx.runMutation(internal.emailIngest.recordInbound, {
      providerEventId,
      kind,
      fromAddress: message.from,
      subject: redactJudgeToken(message.subject),
      body: redactJudgeToken(message.body),
      providerThreadId: message.threadId,
      rawPayload: redactJudgeToken(body).slice(0, 4000),
      ...(judgeToken === null ? {} : { judgeTokenHash: await hashJudgeToken(judgeToken) }),
    });

    return Response.json({ ok: true, stored: result.stored, unmatched: result.unmatched });
  }),
});

http.route({
  path: "/webhooks/firecrawl",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.FIRECRAWL_MONITOR_SECRET;

    if (secret === undefined || secret.length === 0) {
      return new Response("Monitor secret is not configured", { status: 500 });
    }

    if (request.headers.get("x-parallel-monitor") !== secret) {
      return new Response("Invalid monitor credentials", { status: 401 });
    }

    const body = await request.text();
    const payload: unknown = body.length === 0 ? {} : JSON.parse(body);
    const watched = readMonitoredUrl(payload);

    await ctx.scheduler.runAfter(0, internal.agendaSweep.sweepAgendas, {
      ...(watched === null ? {} : { agendaUrl: watched }),
      trigger: "Firecrawl monitor reported a change",
    });

    return Response.json({ ok: true, scheduled: true });
  }),
});

export default http;
