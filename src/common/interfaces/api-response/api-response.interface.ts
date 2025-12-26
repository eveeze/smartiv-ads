export interface ApiResponse<T> {
  statusCode: number;
  success: boolean;
  message: string;
  data: T;
  error?: any;
  timestamp?: string;
  path?: string;
}
