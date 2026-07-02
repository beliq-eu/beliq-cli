/** A user-facing usage problem (bad flag, missing argument, missing key). Maps to EXIT.USAGE. */
export class UsageError extends Error {}

/** A failure reading a document or writing an output file. Maps to EXIT.IO. */
export class IoError extends Error {}
