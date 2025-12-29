declare global {
  interface BigInt {
    toJSON(): string | number;
  }
}

/**
 * Apply Monkey Patch to BigInt prototype.
 * Memungkinkan JSON.stringify menangani BigInt secara otomatis dengan performa native.
 */
export function applyBigIntSerializers(): void {
  // Cek defensif: Jangan override jika environment/library lain sudah melakukannya
  if (!BigInt.prototype.toJSON) {
    Object.defineProperty(BigInt.prototype, 'toJSON', {
      get() {
        'use strict';
        return function () {
          return String(this);
        };
      },
      enumerable: false,
      configurable: true,
    });
  }
}
