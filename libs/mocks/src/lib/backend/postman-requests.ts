/**
 * The request bodies of the backend's Postman collection (corebanking-academy
 * `docs/postman/corebanking-academy.postman_collection.json`), in the order its folders run. The
 * collection has no saved responses, so the contract spec runs these against `FakeBackend` and
 * parses every answer with the endpoint's schema. `{{name}}` is a Postman variable that an
 * earlier answer fills in (`orgId`, `teamId`, `targetUserId`, `grantId`, the role ids) or a
 * fixed sample value (`newUserId`, `newUsername`, the passwords). The five assistant requests are
 * the ones of `docs/postman/assistant.postman_collection.json`.
 */
export interface PostmanRequest {
  readonly name: string;
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Path and query, with Postman variables. */
  readonly url: string;
  /** The raw JSON body with Postman variables, as the collection writes it. */
  readonly body?: string;
}

export const POSTMAN_REQUESTS: readonly PostmanRequest[] = [
  {
    name: 'Đăng nhập',
    method: 'POST',
    url: '/api/v1/auth/login',
    body: '{ "username": {{usernameJson}}, "password": {{passwordJson}} }',
  },
  { name: 'Hồ sơ và quyền hiện tại', method: 'GET', url: '/api/v1/auth/me' },
  { name: 'Danh mục vai trò', method: 'GET', url: '/api/v1/roles' },
  {
    name: 'Danh sách tổ chức',
    method: 'GET',
    url: '/api/v1/orgs?page=0&size=20&sort=sortNo,asc',
  },
  {
    name: 'Tạo tổ chức',
    method: 'POST',
    url: '/api/v1/orgs',
    body: '{ "orgType": "UNIT", "code": "PM_ORG_{{$timestamp}}", "name": "Đơn vị kiểm thử Postman", "sortNo": 0 }',
  },
  { name: 'Chi tiết tổ chức', method: 'GET', url: '/api/v1/orgs/{{orgId}}' },
  {
    name: 'Cập nhật tổ chức',
    method: 'PATCH',
    url: '/api/v1/orgs/{{orgId}}',
    body: '{ "name": "Đơn vị kiểm thử Postman - cập nhật", "sortNo": 1 }',
  },
  {
    name: 'Danh sách nhóm thuộc tổ chức',
    method: 'GET',
    url: '/api/v1/orgs/{{orgId}}/teams?page=0&size=20&sort=name,asc',
  },
  {
    name: 'Tạo nhóm',
    method: 'POST',
    url: '/api/v1/orgs/{{orgId}}/teams',
    body: '{ "code": "PM_TEAM_{{$timestamp}}", "name": "Nhóm kiểm thử Postman", "description": "Dữ liệu kiểm thử API" }',
  },
  {
    name: 'Cập nhật nhóm',
    method: 'PATCH',
    url: '/api/v1/teams/{{teamId}}',
    body: '{ "name": "Nhóm kiểm thử Postman - cập nhật", "description": "Đã cập nhật thông tin nhóm" }',
  },
  {
    name: 'Danh sách người dùng',
    method: 'GET',
    url: '/api/v1/users?page=0&size=20&sort=fullName,asc',
  },
  {
    name: 'Tạo người dùng',
    method: 'POST',
    url: '/api/v1/users',
    body: '{ "userId": "{{newUserId}}", "username": "{{newUsername}}", "fullName": "Người dùng kiểm thử Postman", "email": "postman.user@example.test", "positionName": "Chuyên viên", "orgId": {{orgId}}, "teamId": {{teamId}}, "initialPassword": {{initialPasswordJson}}, "initialRoleGrants": [{"roleId": {{learnerRoleId}}, "scope": "OWN"}] }',
  },
  {
    name: 'Chi tiết người dùng',
    method: 'GET',
    url: '/api/v1/users/{{targetUserId}}',
  },
  {
    name: 'Cập nhật người dùng',
    method: 'PATCH',
    url: '/api/v1/users/{{targetUserId}}',
    body: '{ "fullName": "Người dùng kiểm thử Postman - cập nhật", "positionName": "Chuyên viên kỹ thuật" }',
  },
  {
    name: 'Cập nhật trạng thái tài khoản',
    method: 'PATCH',
    url: '/api/v1/users/{{targetUserId}}/status',
    body: '{ "status": "inactive" }',
  },
  {
    name: 'Cấp vai trò',
    method: 'POST',
    url: '/api/v1/users/{{targetUserId}}/role-grants',
    body: '{ "roleId": {{instructorRoleId}}, "scope": "ORG", "orgId": {{orgId}} }',
  },
  {
    name: 'Thu hồi vai trò',
    method: 'DELETE',
    url: '/api/v1/users/{{targetUserId}}/role-grants/{{grantId}}',
  },
  {
    name: 'Cập nhật hồ sơ cá nhân',
    method: 'PATCH',
    url: '/api/v1/auth/me',
    body: '{ "positionName": "Chuyên viên kỹ thuật" }',
  },
  {
    name: 'Hỏi tài liệu (stream)',
    method: 'POST',
    url: '/api/v1/assistant/agent/stream',
    body: '{ "messages": [{ "role": "user", "content": "CIF là gì?" }] }',
  },
  {
    name: 'Mở màn hình (stream)',
    method: 'POST',
    url: '/api/v1/assistant/agent/stream',
    body: '{ "messages": [{ "role": "user", "content": "Mở trang quản lý người dùng" }] }',
  },
  {
    name: 'Đề xuất đổi hồ sơ (stream)',
    method: 'POST',
    url: '/api/v1/assistant/agent/stream',
    body: '{ "messages": [{ "role": "user", "content": "Đổi chức danh của tôi thành Chuyên viên chính" }] }',
  },
  {
    name: 'Xác nhận yêu cầu',
    method: 'POST',
    url: '/api/v1/assistant/agent/actions/{{actionId}}/confirm',
  },
  {
    name: 'Huỷ yêu cầu',
    method: 'POST',
    url: '/api/v1/assistant/agent/actions/{{actionId}}/cancel',
  },
  {
    name: 'Đổi mật khẩu',
    method: 'PUT',
    url: '/api/v1/auth/password',
    body: '{ "currentPassword": {{passwordJson}}, "newPassword": {{newPasswordJson}} }',
  },
  { name: 'Đăng xuất', method: 'POST', url: '/api/v1/auth/logout' },
];
