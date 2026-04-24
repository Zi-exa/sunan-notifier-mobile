export type AppErrorKind = 'auth' | 'offline' | 'validation' | 'server' | 'unknown';

type AppErrorInput = {
  kind: AppErrorKind;
  message: string;
  code?: string;
  status?: number;
  details?: string;
  cause?: unknown;
};

export class AppError extends Error {
  kind: AppErrorKind;
  code?: string;
  status?: number;
  details?: string;

  constructor(input: AppErrorInput) {
    super(input.message);
    this.name = 'AppError';
    this.kind = input.kind;
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
    this.cause = input.cause;
  }
}

const AUTH_ERROR_CODES = new Set([
  'invalidtoken',
  'accessexception',
  'requireloginerror',
  'require_login_exception',
  'usernotfullysetup',
  'servicerequireslogin',
]);

const OFFLINE_ERROR_KEYWORDS = [
  'network request failed',
  'failed to fetch',
  'networkerror',
  'load failed',
  'timed out',
  'internet',
];

export function normalizeErrorCode(code: string | undefined): string {
  return (code ?? '').trim().toLowerCase();
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isAuthErrorCode(code: string | undefined): boolean {
  return AUTH_ERROR_CODES.has(normalizeErrorCode(code));
}

export function isAuthError(error: unknown): error is AppError {
  return isAppError(error) && error.kind === 'auth';
}

export function isOfflineError(error: unknown): error is AppError {
  return isAppError(error) && error.kind === 'offline';
}

export function toNetworkAwareError(error: unknown, fallbackMessage: string): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const isOffline = OFFLINE_ERROR_KEYWORDS.some((keyword) => message.includes(keyword));

    if (isOffline || error instanceof TypeError) {
      return new AppError({
        kind: 'offline',
        message: fallbackMessage,
        cause: error,
      });
    }

    return new AppError({
      kind: 'unknown',
      message: error.message || 'Terjadi kesalahan saat menghubungi SUNAN.',
      cause: error,
    });
  }

  return new AppError({
    kind: 'unknown',
    message: fallbackMessage,
    cause: error,
  });
}

export function getReadableErrorMessage(
  error: unknown,
  context: 'login' | 'dashboard' | 'tasks' | 'calendar' | 'attendance' | 'generic' = 'generic'
): string {
  if (!isAppError(error)) {
    return context === 'login'
      ? 'Login gagal. Periksa koneksi atau kredensial SUNAN.'
      : 'Terjadi gangguan saat mengambil data SUNAN. Coba lagi beberapa saat.';
  }

  if (error.kind === 'auth') {
    return 'Sesi SUNAN berakhir. Silakan login ulang.';
  }

  if (error.kind === 'offline') {
    if (context === 'login') {
      return 'Tidak bisa login karena perangkat sedang offline. Periksa koneksi internet.';
    }

    return 'Perangkat sedang offline atau koneksi tidak stabil. Tarik layar ke bawah untuk mencoba lagi.';
  }

  if (error.kind === 'validation' && context === 'login') {
    return error.message;
  }

  return error.message || 'Terjadi gangguan saat mengambil data SUNAN. Coba lagi beberapa saat.';
}
