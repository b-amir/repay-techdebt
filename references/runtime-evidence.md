# Runtime Evidence Protocol

Read this reference when static evidence cannot answer execution, cost, concurrency, scale, or
failure questions.

Run `plan-runtime-evidence.js` to discover candidates without executing anything. A test or build
name is not proof of safety: scripts, plugins, fixtures, and applications may write files, access
credentials, use networks, mutate databases, publish messages, or contact production.

Before execution:

1. inspect the exact resolved command, configuration, fixtures, and environment contract;
2. identify filesystem writes, services, databases, queues, network, credentials, and external
   side effects;
3. state which uncertainty the operation will reduce;
4. prefer a disposable/local target and the narrowest representative scenario;
5. ask the user unless the exact operation is already authorized;
6. record the command, outcome, evidence, and limitation in the tool ledger.

Prefer existing artifacts before new execution: test results, traces, profiles, benchmark history,
health checks, logs, metrics, incident reports, and reproducible local captures. Never print secrets
or sensitive event payloads. Production access and production experiments always require explicit
scope and authorization.

Runtime evidence can contradict static expectations. Preserve the contradiction and investigate
instrumentation quality, feature flags, configuration, version/deployment skew, sampling, cache
state, dynamic dispatch, and dead code before deciding which model is accurate.
