import { z } from 'zod';

/**
 * The sign-in form: the backend only requires both fields to be filled (`@NotBlank`), so nothing
 * else is checked here; a wrong pair is the server's IDENTITY-CREDENTIALS_INVALID answer. The
 * username is trimmed before it is sent.
 */
export const LoginFormSchema = z.object({
  username: z.string().refine((value) => value.trim() !== '', {
    error: 'Nhập tên đăng nhập hoặc mã cán bộ.',
  }),
  password: z.string().min(1, { error: 'Nhập mật khẩu.' }),
});
