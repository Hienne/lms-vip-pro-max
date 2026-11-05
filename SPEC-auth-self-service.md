# Capability Map: sign-in self-service (register, forgot password)

Status: **map approved 2026-11-05 (shared `access-requests` module; the inbox is a tab on Người dùng). Module specs are written one at a time, each waits for its own approval before planning:**

- [SPEC-access-requests.md](SPEC-access-requests.md): approved 2026-11-05; app side and backend built (backend committed locally, not pushed).
- [SPEC-self-registration.md](SPEC-self-registration.md): approved 2026-11-05; built (backend committed locally, not pushed).
- `password-reset-request`: not yet written.

`SPEC.md` holds the map of the learner-features initiative and stays as it is. This initiative gets its own map file.

## Objective

The sign-in page offers no way in for a person without an account and no way out for a person who forgot the
password. Today an admin creates every account and nothing else reaches the backend (`/api/v1/auth/*` has
login, logout, me, updateMe, changePassword only).

- **Register:** a visitor sends a request from the sign-in page. An admin approves it, and only then can the
  person sign in.
- **Forgot password:** a visitor sends a reset request from the sign-in page. An admin sets a temporary
  password, and the user must change it at the next sign-in (the existing `mustChangePassword` flow).
- Nothing is sent by mail. The backend has no mail infrastructure and this initiative does not add one.

Users: visitors (anonymous) on the sign-in page; admins in the user-management area.

## Modules

| Module id                | Responsibility                                                                                                                                                        | BE work                                                                  | DB change               | Depends on      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------- | --------------- |
| `access-requests`        | The shared request record, its contract and the admin inbox: list, filter by kind and status, reject. Rate limit and a permission for the inbox.                      | `access_requests` list / reject endpoints, function permission, throttle | `access_requests` table | —               |
| `self-registration`      | "Đăng ký" link and form on the sign-in page; a request of kind `REGISTER`; admin approval that creates the account (pending until approved) and shows it in the inbox | public `POST` register request, approve endpoint creating the user       | none beyond the table   | access-requests |
| `password-reset-request` | "Quên mật khẩu?" link and form on the sign-in page; a request of kind `PASSWORD_RESET`; admin action that sets a temporary password and flags `mustChangePassword`    | public `POST` reset request, admin resolve endpoint                      | none beyond the table   | access-requests |

Build order:

```text
access-requests → self-registration, password-reset-request   (the last two are independent)
```

## Assumptions (correct me now or I proceed with these)

1. Registration fields: staff code, full name, email, unit. The requester chooses no role; an approved account
   starts as learner.
2. Public endpoints answer the same message whether or not the staff code exists, so they cannot be used to
   find valid accounts. Both are throttled by IP and by staff code.
3. The temporary password is shown once to the admin, who passes it to the user by their own means.
4. Frontend, contracts, mock API (`mockBackend`) and backend in `~/my-projects/corebanking-academy` with a
   `docs/sql/` upgrade script, a rollback script and the `psql` command, run locally as in the earlier specs.
   Nothing touches the shared backend.
5. UI copy in Vietnamese, code and docs in English, per `AGENTS.md`.
