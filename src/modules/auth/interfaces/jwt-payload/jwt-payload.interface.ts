export interface JwtPayload {
  sub: number; // Subject (ID User)
  email: string; // Email
  role: string; // Role (ADVERTISER/ADMIN)
  iat?: number; // Issued At (Waktu token dibuat - Otomatis)
  exp?: number; // Expiration (Waktu token kadaluarsa - Otomatis)
}
