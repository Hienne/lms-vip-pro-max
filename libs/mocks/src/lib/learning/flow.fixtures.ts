import type { FlowModel } from '@lms/contracts';

/** Mô phỏng luồng "Chuyển tiền liên ngân hàng qua NAPAS": 7 Đối tượng, 9 Bước chuyển, one own-work step. */
export const NAPAS_FLOW: FlowModel = {
  version: 1,
  objects: [
    { id: 'kh', name: 'Khách hàng', kind: 'customer', x: -6, z: 0 },
    { id: 'app', name: 'BIDV SmartBanking', kind: 'channel', x: -3, z: 0 },
    { id: 'gw', name: 'API Gateway', kind: 'gateway', x: 0, z: 0 },
    { id: 'core', name: 'Core Banking', kind: 'system', x: 3, z: 0 },
    { id: 'so-cai', name: 'Sổ cái', kind: 'database', x: 3, z: 3 },
    { id: 'napas', name: 'NAPAS', kind: 'external', x: 6, z: 0 },
    { id: 'tb', name: 'Hàng đợi thông báo', kind: 'queue', x: 0, z: -3 },
  ],
  steps: [
    {
      id: 's1',
      from: 'kh',
      to: 'app',
      title: 'Khách hàng nhập lệnh chuyển tiền',
      description:
        'Chọn tài khoản nhận ở ngân hàng khác, nhập số tiền và xác thực Smart OTP.',
    },
    {
      id: 's2',
      from: 'app',
      to: 'gw',
      title: 'Ứng dụng gửi yêu cầu chuyển khoản',
      description: 'Yêu cầu được ký và gửi qua kênh mã hóa tới API Gateway.',
    },
    {
      id: 's3',
      from: 'gw',
      to: 'core',
      title: 'Gateway chuyển yêu cầu vào Core',
      description:
        'Gateway kiểm tra phiên đăng nhập và giới hạn tần suất trước khi chuyển tiếp.',
    },
    {
      id: 's4',
      from: 'core',
      to: null,
      title: 'Core kiểm tra số dư và hạn mức',
      description:
        'Nếu không đủ số dư hoặc vượt hạn mức ngày, giao dịch bị từ chối tại đây.',
    },
    {
      id: 's5',
      from: 'core',
      to: 'so-cai',
      title: 'Ghi nợ tài khoản khách hàng',
      description: 'Bút toán ghi nợ và phí được ghi vào sổ cái.',
    },
    {
      id: 's6',
      from: 'core',
      to: 'napas',
      title: 'Gửi lệnh sang NAPAS',
      description:
        'Lệnh chuyển tiền nhanh 24/7 được gửi tới NAPAS để chuyển sang ngân hàng nhận.',
    },
    {
      id: 's7',
      from: 'napas',
      to: 'core',
      title: 'NAPAS phản hồi thành công',
      description: null,
    },
    {
      id: 's8',
      from: 'core',
      to: 'tb',
      title: 'Đẩy thông báo biến động số dư',
      description: 'Thông báo được xếp hàng để gửi bất đồng bộ.',
    },
    {
      id: 's9',
      from: 'tb',
      to: 'app',
      title: 'Ứng dụng hiển thị kết quả',
      description: 'Khách hàng nhận thông báo chuyển tiền thành công.',
    },
  ],
};
