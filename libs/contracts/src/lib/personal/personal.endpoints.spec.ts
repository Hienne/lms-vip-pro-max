import { personalEndpoints as e } from './personal.endpoints';
import { capturedPersonal as captured } from './personal.captured';
import { AddNoteCommandSchema, BookmarkCommandSchema } from './personal.schema';

describe('personalEndpoints (notes and bookmarks)', () => {
  const responses = {
    lessonNotes: captured.lessonNotes,
    addNote: captured.addNote,
    deleteNote: captured.deleteNote,
    lessonBookmarks: captured.lessonBookmarks,
    toggleBookmark: captured.bookmarkOn,
    deleteBookmark: captured.deleteBookmark,
    saved: captured.savedNotes,
  } as const;

  it.each(Object.entries(responses))(
    'parses the response captured from the backend for %s',
    (key, data) => {
      const endpoint = e[key as keyof typeof responses];
      expect(endpoint.response.safeParse(data).success).toBe(true);
    },
  );

  it('parses a bookmark turned off and the bookmarks tab', () => {
    expect(e.toggleBookmark.response.parse(captured.bookmarkOff)).toEqual({
      saved: false,
      bookmark: null,
    });
    expect(
      e.saved.response.parse(captured.savedBookmarks).page.items,
    ).toHaveLength(1);
  });

  it('sends an anchor with only the fields its type uses', () => {
    expect(
      AddNoteCommandSchema.safeParse({
        anchor: { type: 'pdf', blockId: 32, page: 3 },
        text: '  Ghi chú  ',
      }),
    ).toMatchObject({ success: true, data: { text: 'Ghi chú' } });
    expect(
      AddNoteCommandSchema.safeParse({ anchor: { type: 'none' }, text: 'x' })
        .success,
    ).toBe(true);
    expect(
      AddNoteCommandSchema.safeParse({
        anchor: { type: 'pdf', blockId: 32 },
        text: 'x',
      }).success,
    ).toBe(false);
    expect(
      AddNoteCommandSchema.safeParse({ anchor: { type: 'none' }, text: ' ' })
        .success,
    ).toBe(false);
  });

  it('lets a bookmark point only into a file', () => {
    const video = { anchor: { type: 'video', blockId: 33, second: 20 } };
    expect(BookmarkCommandSchema.safeParse(video).success).toBe(true);
    expect(
      BookmarkCommandSchema.safeParse({ anchor: { type: 'none' } }).success,
    ).toBe(false);
  });
});
