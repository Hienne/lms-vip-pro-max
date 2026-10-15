import { SaveGroupCommandSchema } from '@lms/contracts';

/** The group form: only the name is typed; the unit and the kind are not the user's to pick here. */
export const GroupFormSchema = SaveGroupCommandSchema.pick({
  name: true,
}).extend({
  name: SaveGroupCommandSchema.shape.name
    .trim()
    .min(1, { error: 'Nhập tên phòng/nhóm.' }),
});
