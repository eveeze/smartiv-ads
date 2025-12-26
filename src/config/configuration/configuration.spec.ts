import configuration from './configuration';

describe('Configuration Factory', () => {
  // Simpan env asli agar tidak merusak test lain
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules(); // Reset cache module
    process.env = { ...originalEnv }; // Copy env asli
  });

  afterAll(() => {
    process.env = originalEnv; // Kembalikan env asli
  });

  it('should return default values when env vars are missing', () => {
    // Kosongkan env var yang punya default
    delete process.env.PORT;
    delete process.env.MINIO_PORT;
    delete process.env.MINIO_BUCKET;

    const config = configuration();

    expect(config.port).toBe(3000); // Default port
    expect(config.minio.port).toBe(9000);
    expect(config.minio.bucket).toBe('smartiv-media');
  });

  it('should parse environment variables correctly', () => {
    // Set dummy env vars
    process.env.PORT = '8080';
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/db';
    process.env.MINIO_PORT = '9900';
    process.env.REDIS_PORT = '6380';

    const config = configuration();

    // Pastikan string berubah jadi number
    expect(config.port).toBe(8080);
    expect(config.database.url).toBe('postgres://test:test@localhost:5432/db');
    expect(config.minio.port).toBe(9900);
    expect(config.redis.port).toBe(6380);
  });
});
