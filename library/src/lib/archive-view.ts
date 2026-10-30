/** How the archive is drawn: albums (the default) or the records table. Shared by the page (server) and the switch (client). */
export type ArchiveView = 'cards' | 'table';
export const ARCHIVE_VIEW_COOKIE = 'ml_archive_view';
