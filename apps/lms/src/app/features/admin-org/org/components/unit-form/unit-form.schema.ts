import { SaveUnitCommandSchema } from '@lms/contracts';

/** The unit form: the contract's command with the mockup's required-field messages. */
export const UnitFormSchema = SaveUnitCommandSchema.omit({ id: true }).extend({
  code: SaveUnitCommandSchema.shape.code
    .trim()
    .min(1, { error: 'Nhập mã đơn vị.' }),
  name: SaveUnitCommandSchema.shape.name
    .trim()
    .min(1, { error: 'Nhập tên đơn vị.' }),
});
