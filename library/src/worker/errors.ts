/** A failure with a reason the UI can show («فشل: …»); not retried. */
export class ProcessingError extends Error {
  constructor(public code: 'type_mismatch' | 'decode_failed' | 'raw_no_preview' | 'transcode_failed' | 'source_missing' | 'too_large', detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
  }
}
