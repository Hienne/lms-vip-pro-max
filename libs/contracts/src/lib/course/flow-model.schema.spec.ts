import { LessonBlockSchema } from './course.schema';
import { FlowModelSchema } from './flow-model.schema';

const flow = {
  version: 1,
  objects: [
    { id: 'kh', name: 'Khách hàng', kind: 'customer', x: -3, z: 0 },
    { id: 'core', name: 'Core Banking', kind: 'system', x: 3, z: 0 },
  ],
  steps: [
    {
      id: 's1',
      from: 'kh',
      to: 'core',
      title: 'Gửi lệnh',
      description: 'Qua app.',
    },
    {
      id: 's2',
      from: 'core',
      to: null,
      title: 'Kiểm tra hạn mức',
      description: null,
    },
  ],
};

describe('FlowModelSchema', () => {
  it('accepts a Mô phỏng luồng with an own-work step', () => {
    expect(FlowModelSchema.parse(flow).steps[1].to).toBeNull();
  });

  it('refuses another version, an unknown kind and a cell off the grid', () => {
    expect(FlowModelSchema.safeParse({ ...flow, version: 2 }).success).toBe(
      false,
    );
    expect(
      FlowModelSchema.safeParse({
        ...flow,
        objects: [{ ...flow.objects[0], kind: 'robot' }],
      }).success,
    ).toBe(false);
    expect(
      FlowModelSchema.safeParse({
        ...flow,
        objects: [{ ...flow.objects[0], x: 41 }],
      }).success,
    ).toBe(false);
  });

  it('reads a block view with and without a flow', () => {
    const block = {
      id: 1,
      lessonId: 2,
      blockType: 'flow',
      title: 'Chuyển tiền',
      completionMode: 'manual',
      sortNo: 0,
      rowVersion: 0,
    };
    expect(
      LessonBlockSchema.parse({ ...block, flow }).flow?.objects,
    ).toHaveLength(2);
    expect(
      LessonBlockSchema.parse({ ...block, blockType: 'text', flow: null }).flow,
    ).toBeNull();
    expect(
      LessonBlockSchema.parse({ ...block, blockType: 'text' }).flow,
    ).toBeUndefined();
  });
});
