/** The status line while a tool runs, for the panel and for the screen reader. */
export function toolStatusText(toolName: string | null): string {
  switch (toolName) {
    case 'search_documents':
      return 'Đang tìm trong tài liệu…';
    case 'search_community':
      return 'Đang tìm trong cộng đồng…';
    case 'open_screen':
      return 'Đang mở màn hình…';
    case 'update_profile':
      return 'Đang chuẩn bị thay đổi…';
    default:
      return 'Đang xử lý…';
  }
}
