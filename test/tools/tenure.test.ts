import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { AxiosError } from 'axios';

// Mock modules before importing the module under test
vi.mock('@amzn/midway-client', () => ({
  getAxiosInstance: vi.fn().mockReturnValue({
    get: vi.fn() as any,
    defaults: {
      headers: {
        common: {},
      },
    },
  }),
}));

vi.mock('@amzn/midway-client-suite-library-node-js/dist/index.js', () => ({
  MidwayClientSuiteLibrary: vi.fn(),
  isIdpAuthRedirect: vi.fn(),
}));

// Import the module under test after mocking dependencies
import { getTenureDays, amazonTenureTool } from '../../src/tools/tenure';
import { getAxiosInstance } from '@amzn/midway-client';
import { isIdpAuthRedirect, MidwayClientSuiteLibrary } from '@amzn/midway-client-suite-library-node-js/dist/index.js';

describe('tenure module', () => {
  // Mock implementations
  const mockAxioGet = vi.mocked(getAxiosInstance().get);
  const mockMcsLibraryAuthorize = vi.fn();
  const mockMcsLibraryClose = vi.fn();

  beforeAll(() => {
    // Suppress the errors printed by server
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    // restore console spy
    vi.restoreAllMocks();
  });

  // Reset all mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(MidwayClientSuiteLibrary).mockImplementation(
      () =>
        ({
          authorize: mockMcsLibraryAuthorize,
          close: mockMcsLibraryClose,
        }) as any,
    );
  });

  describe('amazon tenure tool', () => {
    it('should return tenure days when API call succeeds', async () => {
      // Mock the first response with a redirect location
      mockAxioGet.mockImplementationOnce(() => {
        return Promise.resolve({
          status: 307,
          headers: {
            location: 'https://midway-auth.amazon.com/redirect',
          },
          request: {
            url: 'https://phonetool.amazon.com/users/mockuser.json',
          },
        });
      });

      // Mock the second response with the tenure data
      mockAxioGet.mockImplementationOnce(() => {
        return Promise.resolve({
          status: 200,
          data: {
            tenure_days: 42,
          },
        });
      });

      vi.mocked(isIdpAuthRedirect).mockReturnValue(true);
      mockMcsLibraryAuthorize.mockResolvedValue('https://phonetool.amazon.com/users/mockuser.json?token=abc123');

      // Call the tool
      const result = await amazonTenureTool.cb({ login: 'mockuser' }, {} as any);

      // Verify the result
      expect(result.content[0].text).toEqual('Tenure of mockuser is 42 days.');
      expect(result.isError).toBeFalsy();

      // Verify the function calls
      expect(mockAxioGet).toHaveBeenCalledTimes(2);
      expect(mockAxioGet).toHaveBeenNthCalledWith(
        1,
        'https://phonetool.amazon.com/users/mockuser.json',
        expect.objectContaining({ maxRedirects: 0 }),
      );
      expect(isIdpAuthRedirect).toHaveBeenCalledWith('https://midway-auth.amazon.com/redirect');
      expect(mockMcsLibraryAuthorize).toHaveBeenCalledWith('https://midway-auth.amazon.com/redirect');
      expect(mockMcsLibraryClose).toHaveBeenCalledTimes(1);
      expect(mockAxioGet).toHaveBeenNthCalledWith(2, 'https://phonetool.amazon.com/users/mockuser.json?token=abc123');
    });

    it('should return an error when MidwayClientSuiteLibrary authorization fails', async () => {
      // Mock the first response with a redirect location
      mockAxioGet.mockImplementationOnce(() => {
        return Promise.resolve({
          status: 307,
          headers: {
            location: 'https://midway-auth.amazon.com/redirect',
          },
          request: {
            url: 'https://phonetool.amazon.com/users/mockuser.json',
          },
        });
      });

      vi.mocked(isIdpAuthRedirect).mockReturnValue(true);
      const authError = new Error('Authorization failed');
      mockMcsLibraryAuthorize.mockRejectedValue(authError);

      // Call the function and expect it to throw the error
      const result = await amazonTenureTool.cb({ login: 'mockuser' }, {} as any);

      // Verify tool error conversion
      expect(result.content[0].text).toEqual(
        'Unable to retrieve the tenure for mockuser: Unable to authorize Midway request',
      );
      expect(result.isError).toBeTruthy();

      // Verify the function calls
      expect(mockAxioGet).toHaveBeenCalledTimes(1);
      expect(mockAxioGet).toHaveBeenCalledWith(
        'https://phonetool.amazon.com/users/mockuser.json',
        expect.objectContaining({ maxRedirects: 0 }),
      );
      expect(isIdpAuthRedirect).toHaveBeenCalledWith('https://midway-auth.amazon.com/redirect');
      expect(mockMcsLibraryAuthorize).toHaveBeenCalledWith('https://midway-auth.amazon.com/redirect');
      expect(mockMcsLibraryClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTenureDays function', () => {
    it('should throw an error when redirected call fails', async () => {
      // Mock the first response with a redirect location
      mockAxioGet.mockImplementationOnce(() => {
        return Promise.resolve({
          status: 307,
          headers: {
            location: 'https://midway-auth.amazon.com/redirect',
          },
          request: {
            url: 'https://phonetool.amazon.com/users/mockuser.json',
          },
        });
      });

      vi.mocked(isIdpAuthRedirect).mockReturnValue(true);
      const apiError = new AxiosError('Request failed with status code 500', AxiosError.ERR_BAD_RESPONSE);
      mockAxioGet.mockImplementationOnce(() => Promise.reject(apiError));
      mockMcsLibraryAuthorize.mockResolvedValue('https://phonetool.amazon.com/users/mockuser.json?token=abc123');

      // Call the function and expect it to throw the error
      await expect(getTenureDays('mockuser')).rejects.toThrow(apiError);

      // Verify the function calls
      expect(mockAxioGet).toHaveBeenCalledTimes(2);
      expect(isIdpAuthRedirect).toHaveBeenCalledWith('https://midway-auth.amazon.com/redirect');
      expect(mockMcsLibraryAuthorize).toHaveBeenCalledWith('https://midway-auth.amazon.com/redirect');
      expect(mockMcsLibraryClose).toHaveBeenCalledTimes(1);
      expect(mockAxioGet).toHaveBeenNthCalledWith(2, 'https://phonetool.amazon.com/users/mockuser.json?token=abc123');
    });

    it('should proceed with regular redirect when not an IDP auth redirect', async () => {
      // Mock the first response with a redirect location
      mockAxioGet.mockImplementationOnce(() => {
        return Promise.resolve({
          status: 307,
          headers: {
            location: 'https://regular-redirect.amazon.com',
          },
          request: {
            url: 'https://phonetool.amazon.com/users/mockuser.json',
          },
        });
      });

      vi.mocked(isIdpAuthRedirect).mockReturnValue(false);

      // Call the function being tested
      const result = await getTenureDays('mockuser');

      // Verify the result
      expect(result).toBe('https://phonetool.amazon.com/users/mockuser.json');

      // Verify the function calls
      expect(mockAxioGet).toHaveBeenCalledTimes(1); // Only called once since we're returning the URL directly
      expect(mockAxioGet).toHaveBeenCalledWith(
        'https://phonetool.amazon.com/users/mockuser.json',
        expect.objectContaining({ maxRedirects: 0 }),
      );
      expect(isIdpAuthRedirect).toHaveBeenCalledWith('https://regular-redirect.amazon.com');
      expect(mockMcsLibraryAuthorize).not.toHaveBeenCalled();
      expect(mockMcsLibraryClose).not.toHaveBeenCalled();
    });

    it('should return tenure days when initial request returns 200 with cookies', async () => {
      // Mock the first response with a 200 status and tenure data (cookie used case)
      mockAxioGet.mockImplementationOnce(() => {
        return Promise.resolve({
          status: 200,
          data: {
            tenure_days: 42,
          },
          request: {
            url: 'https://phonetool.amazon.com/users/mockuser.json',
          },
        });
      });

      // Call the function being tested
      const result = await getTenureDays('mockuser');

      // Verify the result
      expect(result).toBe(42);

      // Verify the function calls
      expect(mockAxioGet).toHaveBeenCalledTimes(1);
      expect(mockAxioGet).toHaveBeenCalledWith(
        'https://phonetool.amazon.com/users/mockuser.json',
        expect.objectContaining({ maxRedirects: 0 }),
      );
      expect(isIdpAuthRedirect).not.toHaveBeenCalled();
      expect(mockMcsLibraryAuthorize).not.toHaveBeenCalled();
      expect(mockMcsLibraryClose).not.toHaveBeenCalled();
    });

    it('should throw an error when response status is unexpected (not 200 or redirect)', async () => {
      // Mock the first response with a non-redirect status
      mockAxioGet.mockImplementationOnce(() => {
        return Promise.resolve({
          status: 403, // Forbidden or other error status
        });
      });

      // Call the function and expect it to throw an error
      await expect(getTenureDays('mockuser')).rejects.toThrow('Internal server error');

      // Verify the function calls
      expect(mockAxioGet).toHaveBeenCalledTimes(1);
      expect(mockAxioGet).toHaveBeenCalledWith(
        'https://phonetool.amazon.com/users/mockuser.json',
        expect.objectContaining({ maxRedirects: 0 }),
      );
      expect(isIdpAuthRedirect).not.toHaveBeenCalled();
      expect(mockMcsLibraryAuthorize).not.toHaveBeenCalled();
      expect(mockMcsLibraryClose).not.toHaveBeenCalled();
    });

    it('should return tenure days after successful MCS authorization', async () => {
      // Mock the first response with a redirect location
      mockAxioGet.mockImplementationOnce(() => {
        return Promise.resolve({
          status: 307,
          headers: {
            location: 'https://midway-auth.amazon.com/redirect',
          },
          request: {
            url: 'https://phonetool.amazon.com/users/mockuser.json',
          },
        });
      });

      vi.mocked(isIdpAuthRedirect).mockReturnValue(true);
      mockMcsLibraryAuthorize.mockResolvedValue('https://phonetool.amazon.com/users/mockuser.json?token=abc123');

      // Mock the second response with the tenure data
      mockAxioGet.mockImplementationOnce(() => {
        return Promise.resolve({
          status: 200,
          data: {
            tenure_days: 100,
          },
        });
      });

      // Call the function being tested
      const result = await getTenureDays('mockuser');

      // Verify the result
      expect(result).toBe(100);

      // Verify the function calls
      expect(mockAxioGet).toHaveBeenCalledTimes(2);
      expect(mockAxioGet).toHaveBeenNthCalledWith(
        1,
        'https://phonetool.amazon.com/users/mockuser.json',
        expect.objectContaining({ maxRedirects: 0 }),
      );
      expect(isIdpAuthRedirect).toHaveBeenCalledWith('https://midway-auth.amazon.com/redirect');
      expect(mockMcsLibraryAuthorize).toHaveBeenCalledWith('https://midway-auth.amazon.com/redirect');
      expect(mockMcsLibraryClose).toHaveBeenCalledTimes(1);
      expect(mockAxioGet).toHaveBeenNthCalledWith(2, 'https://phonetool.amazon.com/users/mockuser.json?token=abc123');
    });

    it('should throw an error when final response status is not 200', async () => {
      // Mock the first response with a redirect location
      mockAxioGet.mockImplementationOnce(() => {
        return Promise.resolve({
          status: 307,
          headers: {
            location: 'https://midway-auth.amazon.com/redirect',
          },
          request: {
            url: 'https://phonetool.amazon.com/users/mockuser.json',
          },
        });
      });

      vi.mocked(isIdpAuthRedirect).mockReturnValue(true);
      mockMcsLibraryAuthorize.mockResolvedValue('https://phonetool.amazon.com/users/mockuser.json?token=abc123');

      // Mock the second response with a non-200 status
      mockAxioGet.mockImplementationOnce(() => {
        return Promise.resolve({
          status: 404,
          statusText: 'Not Found',
        });
      });

      // Call the function and expect it to throw an error
      await expect(getTenureDays('mockuser')).rejects.toThrow('Internal server error');

      // Verify the function calls
      expect(mockAxioGet).toHaveBeenCalledTimes(2);
      expect(isIdpAuthRedirect).toHaveBeenCalledWith('https://midway-auth.amazon.com/redirect');
      expect(mockMcsLibraryAuthorize).toHaveBeenCalledWith('https://midway-auth.amazon.com/redirect');
      expect(mockMcsLibraryClose).toHaveBeenCalledTimes(1);
    });
  });
});
