/** The sidebar fold, remembered per browser. A plain module: the server shell reads it, the client toggle writes it
 * (a constant exported from a 'use client' file reaches the server as a client reference, not as the string). */
export const SIDEBAR_COOKIE = 'ml_sidebar';
