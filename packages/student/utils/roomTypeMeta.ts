/**
 * Single source of truth for everything the student app renders differently per room type.
 *
 * Before this module, `App.tsx` re-derived each of these properties in its own inline
 * `room.type === '...'` chain: one for the header border/background, one for the heading
 * colour, one for the badge colour, one for the heading text, one for the sub-line, and one
 * for the accessible name. Six parallel chains over the same six values is how the accessible
 * name drifted out of sync with the visible heading (see `resolveRoomMeta` below).
 *
 * Class names live here as plain strings rather than in `App.tsx`. That is safe because
 * `tailwind.config.js` lists `./utils/**\/*.ts` in its `content` globs, so Tailwind still sees
 * every class and does not purge them. Keep this file a `.ts` module for that reason — `.tsx`
 * is NOT in the content globs, and moving these strings into one would silently drop the
 * colours from a production build.
 */

/**
 * Every room type the server can create, and therefore every type that can reach this app.
 *
 * The compiler cannot check this list against the server, so it is verified by hand against
 * the three places that enumerate room types:
 *   - `packages/server/src/config/constants.js` -> `ROOM_TYPES`
 *   - `packages/server/src/models/Session.js` -> `createRoom`'s switch (throws on anything else)
 *   - `packages/shared/types/socket.types.ts` -> `RoomType`
 * All three list exactly these six. `Session.createRoom` throwing on an unknown type is what
 * makes this list complete rather than merely current: a seventh type cannot be created
 * server-side without editing that switch.
 *
 * `RoomType` is derived from this array, and `ROOM_TYPE_META` below is a
 * `Record<RoomType, ...>`, so the compiler rejects the table if an entry is missing or if a
 * key is not a real room type — even with `strictNullChecks: false`. Adding a room type here
 * therefore forces a table entry.
 */
export const ROOM_TYPES = ['poll', 'linkShare', 'rtfeedback', 'questions', 'handout', 'activity'] as const;

export type RoomType = (typeof ROOM_TYPES)[number];

/** Tailwind classes for the three tinted surfaces of a room card's header. */
export interface RoomPalette {
  /** Bottom border, background and hover background of the clickable header strip. */
  header: string;
  /** Heading text colour. */
  title: string;
  /** Background of the round expand/collapse badge. */
  badge: string;
}

/** Static, per-room-type presentation. Anything per-instance is resolved in `resolveRoomMeta`. */
export interface RoomTypeMeta {
  /** Heading, and the base of the accessible name. Used verbatim unless a per-instance title exists. */
  label: string;
  /** Sub-line under the heading, without the leading bullet. Empty string renders no sub-line. */
  description: string;
  /** Colours used while the room is accepting input. Inactive rooms use `INACTIVE_ROOM_PALETTE`. */
  palette: RoomPalette;
  /**
   * Whether this room type's payload carries a per-instance title and instructions
   * (`initialData.activity`) that should override `label` / `description`. Only the generic
   * `activity` room type does; every other type has a fixed label written by us.
   */
  showsPerInstanceTitle: boolean;
}

/**
 * Colours for a room the teacher has paused or not yet started, for every room type. The
 * header deliberately has no hover classes here, matching the pre-refactor markup: a stopped
 * room stays visually flat even though the header is still clickable to collapse.
 */
export const INACTIVE_ROOM_PALETTE: RoomPalette = {
  header: 'border-warm-gray-400 dark:border-warm-gray-600 bg-warm-gray-100 dark:bg-warm-gray-800',
  title: 'text-warm-gray-600 dark:text-warm-gray-400',
  badge: 'bg-warm-gray-500 dark:bg-warm-gray-600 text-white'
};

export const ROOM_TYPE_META: Record<RoomType, RoomTypeMeta> = {
  poll: {
    label: 'Poll Activity',
    description: '',
    showsPerInstanceTitle: false,
    palette: {
      header: 'border-sage-500 dark:border-sage-400 bg-sage-100 dark:bg-sage-900/30 hover:bg-sage-200 dark:hover:bg-sage-900/40',
      title: 'text-sage-700 dark:text-sage-300',
      badge: 'bg-sage-500 dark:bg-sage-600 text-white'
    }
  },
  linkShare: {
    label: 'Share Links',
    description: 'Share presentation links with your teacher',
    showsPerInstanceTitle: false,
    palette: {
      header: 'border-terracotta-500 dark:border-terracotta-400 bg-terracotta-100 dark:bg-terracotta-900/30 hover:bg-terracotta-200 dark:hover:bg-terracotta-900/40',
      title: 'text-terracotta-700 dark:text-terracotta-300',
      badge: 'bg-terracotta-500 dark:bg-terracotta-600 text-white'
    }
  },
  rtfeedback: {
    label: 'Real-Time Feedback',
    description: "Adjust the slider to let your teacher know how you're doing",
    showsPerInstanceTitle: false,
    palette: {
      header: 'border-amber-500 dark:border-amber-400 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/40',
      title: 'text-amber-700 dark:text-amber-300',
      badge: 'bg-amber-500 dark:bg-amber-600 text-white'
    }
  },
  questions: {
    label: 'Ask Questions',
    description: 'Submit questions to your teacher',
    showsPerInstanceTitle: false,
    palette: {
      header: 'border-sky-500 dark:border-sky-400 bg-sky-100 dark:bg-sky-900/30 hover:bg-sky-200 dark:hover:bg-sky-900/40',
      title: 'text-sky-700 dark:text-sky-300',
      badge: 'bg-sky-500 dark:bg-sky-600 text-white'
    }
  },
  handout: {
    label: 'Handout',
    description: 'View content shared by your teacher',
    showsPerInstanceTitle: false,
    palette: {
      header: 'border-slate-blue-500 dark:border-slate-blue-400 bg-slate-blue-100 dark:bg-slate-blue-900/30 hover:bg-slate-blue-200 dark:hover:bg-slate-blue-900/40',
      title: 'text-slate-blue-700 dark:text-slate-blue-300',
      badge: 'bg-slate-blue-500 dark:bg-slate-blue-600 text-white'
    }
  },
  activity: {
    label: 'Interactive Activity',
    description: '',
    showsPerInstanceTitle: true,
    palette: {
      header: 'border-purple-500 dark:border-purple-400 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/40',
      title: 'text-purple-700 dark:text-purple-300',
      badge: 'bg-purple-500 dark:bg-purple-600 text-white'
    }
  }
};

/**
 * Fallback for a room type this build does not know about — a newer server announcing a room
 * type added after this bundle shipped. The old inline chains ended in the `questions` branch,
 * so such a room was labelled "Ask Questions" in sky blue and then rendered an empty body,
 * which reads as a broken Questions widget rather than as an unknown one. This entry instead
 * gives it a neutral grey card and a generic label, and `isKnownRoomType` lets `App.tsx`
 * explain the empty body rather than leaving it blank.
 *
 * Unreachable for any room the current server can create; see `ROOM_TYPES` above.
 */
export const UNKNOWN_ROOM_TYPE_META: RoomTypeMeta = {
  label: 'Activity',
  description: '',
  showsPerInstanceTitle: false,
  palette: INACTIVE_ROOM_PALETTE
};

/** Whether this build has a table entry (and a body renderer) for `type`. */
export const isKnownRoomType = (type: string): type is RoomType =>
  (ROOM_TYPES as readonly string[]).includes(type);

/** The per-instance details an `activity` room carries in its `initialData`. */
interface RoomActivityDetails {
  title?: string;
  instructions?: string;
}

/** The parts of a joined room that affect its header presentation. */
export interface RoomMetaInput {
  type: RoomType | string;
  initialData?: { activity?: RoomActivityDetails } | null;
  isActive?: boolean;
}

/** Everything the header needs, with per-instance titles and active state already applied. */
export interface ResolvedRoomMeta {
  /** Visible heading. */
  label: string;
  /** Accessible name for the room, before the expand/collapse hint the caller appends. */
  ariaLabel: string;
  /** Visible sub-line, bullet included. Empty string renders no sub-line. */
  description: string;
  palette: RoomPalette;
}

/**
 * Resolve a room's header presentation.
 *
 * `label` and `ariaLabel` are derived from the same per-instance title here, which is the
 * fix for the divergence this module replaces: the old accessible name came from its own
 * branch chain that never read `initialData.activity.title`, so an activity room showing
 * "Photosynthesis" announced itself as the generic "Interactive Activity" and a screen-reader
 * user could not tell two activity cards apart. The accessible name keeps the room-type prefix
 * ("Interactive Activity: Photosynthesis") because a sighted user gets that context from the
 * card's colour, which does not survive into the accessibility tree. The visible heading is a
 * substring of the accessible name, as WCAG 2.5.3 Label in Name requires.
 */
export const resolveRoomMeta = (room: RoomMetaInput): ResolvedRoomMeta => {
  const meta = ROOM_TYPE_META[room.type as RoomType] ?? UNKNOWN_ROOM_TYPE_META;
  const details = meta.showsPerInstanceTitle ? room.initialData?.activity : undefined;
  const instructions = details?.instructions || meta.description;

  return {
    label: details?.title || meta.label,
    ariaLabel: details?.title ? `${meta.label}: ${details.title}` : meta.label,
    description: instructions ? `• ${instructions}` : '',
    palette: room.isActive ? meta.palette : INACTIVE_ROOM_PALETTE
  };
};
