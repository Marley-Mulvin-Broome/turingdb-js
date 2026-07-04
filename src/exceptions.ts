export class TuringDBException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TuringDBException";
  }
}
