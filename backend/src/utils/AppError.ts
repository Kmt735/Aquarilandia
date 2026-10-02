export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly detalhes?: Record<string, string>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}
