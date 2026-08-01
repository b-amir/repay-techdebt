# Application Context

Fill in what is known before requesting a workbook or PR lesson. Leave unknown items bracketed.
Do not include secrets, access tokens, private keys, production credentials, or customer data.

## App Purpose

- **Problem solved:** [What user or business problem does this application solve?]
- **Primary users:** [Who uses it?]
- **Critical workflows:** [Which actions must remain correct?]
- **Domain vocabulary:** [Terms whose project-specific meanings matter]

## Core Tech Stack

| Layer    | Technology                              | Why it is used      |
| -------- | --------------------------------------- | ------------------- |
| Runtime  | [e.g. Node.js, Python]                  | [Reason or unknown] |
| UI       | [e.g. React, server-rendered templates] | [Reason or unknown] |
| API      | [e.g. Express, FastAPI]                 | [Reason or unknown] |
| Data     | [e.g. PostgreSQL, Redis]                | [Reason or unknown] |
| Tests    | [e.g. Vitest, pytest]                   | [Reason or unknown] |
| Delivery | [e.g. containers, serverless]           | [Reason or unknown] |

## Primary Data Flow

Describe the main path through the system.

```text
[User or caller] -> [Entry point] -> [Domain logic] -> [Storage or external service]
                                      |
                                      -> [Events, cache, or background work]
```

- **Inputs:** [Requests, events, files, commands]
- **Transformations:** [Important validation or business rules]
- **Outputs:** [Responses, state changes, events]
- **State ownership:** [Where authoritative state lives]

## External Integrations

| Integration | Purpose         | Direction                   | Failure behavior              |
| ----------- | --------------- | --------------------------- | ----------------------------- |
| [Service]   | [Why it exists] | [Inbound / outbound / both] | [Retry, fallback, or unknown] |

## Known Constraints

- **Security or compliance:** [Constraints or unknown]
- **Performance:** [Latency, throughput, or scale expectations]
- **Compatibility:** [Supported platforms or clients]
- **Areas of concern:** [Code the learner most wants to understand]
