import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPackageVersion, validateAmazonLogin } from '../src/utils';
import * as fs from 'fs';
import * as findUpSimple from 'find-up-simple';

// Mock the dependencies
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

vi.mock('find-up-simple', () => ({
  findUpSync: vi.fn(),
}));

describe('utils', () => {
  describe('getPackageVersion', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return the package version', () => {
      vi.mocked(findUpSimple.findUpSync).mockReturnValue('/path/to/package.json');
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ version: '1.2.3' }));

      const version = getPackageVersion();

      expect(findUpSimple.findUpSync).toHaveBeenCalledWith('package.json', { cwd: expect.any(String) });
      expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/package.json', 'utf8');
      expect(version).toBe('1.2.3');
    });

    it('should throw an error if package.json is not found', () => {
      vi.mocked(findUpSimple.findUpSync).mockReturnValue(undefined);

      expect(() => getPackageVersion()).toThrow('Could not find up package.json from'); // substring of error message works
    });
  });

  describe('validateAmazonLogin', () => {
    it.each([['looooooooong'], ['hello!'], ['s'], ['aaa1'], ['UPPER'], [' ']])(
      'should throw an error when validation failed for %s',
      (login) => {
        expect(() => validateAmazonLogin(login)).toThrow('Invalid login syntax. Must match regex /^[a-z]{3,8}$/');
      },
    );
  });
});
