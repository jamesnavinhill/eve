import { trace } from "@opentelemetry/api";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { PostHogTraceExporter } from "@posthog/ai/otel";
import * as Sentry from "@sentry/node";
import { registerOTel } from "@vercel/otel";
import { defineInstrumentation } from "eve/instrumentation";

// PostHog AI Observability — exports OTel spans from every model call, tool
// call, and channel delivery. Sessions are tagged with the auth principal
// (distinct_id) so traces resolve to the calling identity in PostHog.
// Sentry — error tracking + performance tracing for the same agent process.
//
// Env vars:
//   POSTHOG_PROJECT_TOKEN — PostHog project token (NOT the API key; the OTel
//     exporter uses the project token for ingestion)
//   POSTHOG_HOST — PostHog host (defaults to https://us.i.posthog.com)
//   SENTRY_DSN — Sentry DSN for error/perf reporting
//   SENTRY_ENVIRONMENT — environment tag (defaults to "eve-local")
//   EVE_TRACES_CONTENT — set to "on" to record full inputs/outputs on spans
//     (off by default; enable only when the destination is approved)
export default defineInstrumentation({
  setup: ({ agentName }) => {
    // Initialize Sentry before OTel so the error handler captures everything.
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENVIRONMENT ?? "eve-local",
        tracesSampleRate: 1.0,
        profilesSampleRate: 1.0,
      });
    }

    return registerOTel({
      serviceName: agentName,
      spanProcessors: [
        new SimpleSpanProcessor(
          new PostHogTraceExporter({
            projectToken: process.env.POSTHOG_PROJECT_TOKEN!,
            host: process.env.POSTHOG_HOST,
          }),
        ),
      ],
    });
  },

  // Tag every step span with the session's auth principal so PostHog can
  // attribute traces to the calling identity. Falls back from initiator
  // (root session principal) to current (this turn's caller) so subagent
  // sessions still resolve to their root initiator.
  events: {
    "step.started"(input) {
      const distinctId =
        input.session.auth.initiator?.principalId ?? input.session.auth.current?.principalId;

      if (!distinctId) return undefined;

      trace.getActiveSpan()?.setAttribute("posthog.distinct_id", distinctId);
      return { runtimeContext: { posthog_distinct_id: distinctId } };
    },
  },
});
