// test/jest-e2e.setup.ts

// Set Environment Variables untuk Testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';
process.env.JWT_EXPIRES_IN = '1h';

// MinIO (Dummy values)
process.env.MINIO_ENDPOINT = 'localhost';
process.env.MINIO_PORT = '9000';
process.env.MINIO_ACCESS_KEY = 'minioadmin';
process.env.MINIO_SECRET_KEY = 'minioadmin';
process.env.MINIO_BUCKET = 'test-bucket';

// Redis
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Database URL
// FIX: Menggunakan kredensial postgres:postgres sesuai docker-compose.yml
// Menggunakan DB 'smartiv_db' yang sudah ada skemanya (karena sudah dijalankan di dev)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@localhost:5432/smartiv_db?schema=public';
}
