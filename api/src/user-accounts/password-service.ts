import {
  randomBytes as nodeRandomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'node:crypto';

const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_BYTES = 64;
const SALT_BYTES = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export class PasswordService {
  constructor(
    private readonly randomBytes: (size: number) => Buffer = nodeRandomBytes,
  ) {}

  async hash(password: string): Promise<string> {
    const salt = this.randomBytes(SALT_BYTES);
    const key = await deriveKey(password, salt, KEY_BYTES, {
      N: COST,
      r: BLOCK_SIZE,
      p: PARALLELIZATION,
      maxmem: MAX_MEMORY,
    });
    return [
      'scrypt',
      COST,
      BLOCK_SIZE,
      PARALLELIZATION,
      salt.toString('base64url'),
      key.toString('base64url'),
    ].join('$');
  }

  async verify(password: string, encoded: string): Promise<boolean> {
    const [algorithm, cost, blockSize, parallelization, saltValue, keyValue] =
      encoded.split('$');
    if (
      algorithm !== 'scrypt' ||
      !cost ||
      !blockSize ||
      !parallelization ||
      !saltValue ||
      !keyValue
    )
      return false;
    const expected = Buffer.from(keyValue, 'base64url');
    if (expected.length !== KEY_BYTES) return false;
    const actual = await deriveKey(
      password,
      Buffer.from(saltValue, 'base64url'),
      expected.length,
      {
        N: Number(cost),
        r: Number(blockSize),
        p: Number(parallelization),
        maxmem: MAX_MEMORY,
      },
    );
    return timingSafeEqual(actual, expected);
  }
}
