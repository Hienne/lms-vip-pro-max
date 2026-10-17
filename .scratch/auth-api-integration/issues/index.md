---
artifact: ticket-index
status: ready
workspace: lms-vip-pro-max
project: lms
source: .scratch/auth-api-integration/spec.md
source_revision: 2
revision: 5
---

# Auth API integration — tickets

Source: `.scratch/auth-api-integration/spec.md` revision 1.

## Dependency graph

```text
01 ──► 02 ──► 03
        │      │
        └──────┴──► 04
```

## Tickets

- [01](01-v1-auth-contract.md): v1 auth contract, envelope and inactive status — done
- [02](02-sign-in-with-bearer-token.md): sign in, restore and bearer token — done
- [03](03-logout-everywhere.md): logout always ends the local session — done
- [04](04-retire-mock-auth.md): dev toolbar mock-only switch; retire old auth endpoints — done

## Frontier

- (none: all tickets done)
