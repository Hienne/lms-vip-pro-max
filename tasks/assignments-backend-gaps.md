# Backend gaps: course assignments screen

The `/admin/assignments` screen follows the mockup's `assignments` page (`lms-mockup/src/pages/admin-org.js`)
where the backend has the data. The items below are mockup features the frontend leaves out until
the backend serves them; the app must not compute them on the client (AGENTS.md "Business rules
stay on the server").

Current endpoints: `GET/POST /api/v1/courses/{courseId}/assignments`,
`GET /api/v1/learning-assignments/{assignmentId}`,
`POST /api/v1/learning-assignments/recipients/{recipientId}/revoke`, and the learning-group endpoints
(`libs/contracts/src/lib/assignment/assignment.endpoints.ts`).

## G1: List assignments across courses

**Mockup:** the "Khóa học" filter has an "all courses" option and the table has a "Khóa học" column.

**Needed:** a list endpoint for an assigning org without `courseId` (paged, optional course filter),
returning the course title and code with each assignment.

**Frontend then:** add the "all courses" option and the "Khóa học" column.

## G2: Counts and progress per assignment in the list

**Mockup columns:** "Đối tượng" (target type and name), "Người" (recipients), "Tiến độ" (% and
`completed/people`), "Quá hạn" (overdue learners).

**Needed:** on each list item: target summaries (type and name snapshot), active recipient count,
completed count, progress %, overdue count, all computed on the server.

**Frontend then:** add the four columns.

## G3: Sorting the list

**Mockup:** sortable columns.

**Needed:** a `sort` query on the list (at least start, due, title), since the list is paged on the
server.

## G4: Change the due date ("Sửa hạn")

**Mockup:** the row action "Sửa hạn" opens the drawer as "Sửa lượt giao" with the dates; saving
applies at once ("Đã cập nhật hạn").

**Needed:** an update endpoint for an assignment's start/due dates and reminder, with
`expectedVersion` (`rowVersion`) for concurrency.

## G5: Send a reminder ("Nhắc học")

**Mockup:** the row action "Nhắc học" notifies the learners who have not finished and reports how
many were reminded; disabled when everyone has finished.

**Needed:** a remind endpoint per assignment returning the number of learners notified.

## G6: Revoke a whole assignment ("Thu hồi")

**Mockup:** the row action "Thu hồi" ends the assignment for everyone; progress already made stays.

**Needed:** a revoke endpoint per assignment (with a reason, like the per-recipient revoke).
Today only one recipient at a time can be revoked, from the detail drawer.
