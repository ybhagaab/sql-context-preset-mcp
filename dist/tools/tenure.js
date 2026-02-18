import { z } from 'zod';
import { getAxiosInstance } from '@amzn/midway-client';
import { isIdpAuthRedirect, MidwayClientSuiteLibrary } from '@amzn/midway-client-suite-library-node-js/dist/index.js';
import { getPackageVersion, validateAmazonLogin } from '../utils.js';
const PHONE_TOOL_DOMAIN = 'phonetool.amazon.com';
const USER_AGENT = `sql-context-presets/${getPackageVersion()}`;
const axiosInstance = getAxiosInstance(); // Midway cookies and trust stores are loaded
axiosInstance.defaults.headers.common['User-Agent'] = USER_AGENT; // Allow server to identify the client application
axiosInstance.defaults.withCredentials = true; // Send cookies with the request
axiosInstance.defaults.validateStatus = function (status) {
    return status < 500; // Resolve only if the status code is less than 500, otherwise throw ERR_BAD_RESPONSE
};
axiosInstance.defaults.maxRedirects = 1; // Value varies depending on use case. Here we pick a number for demonstration purpose.
// This is an example function demonstrating how to use Midway and MidwayClientSuite.
// You can find other examples:
// - https://code.amazon.com/packages/MidwayClientSuiteLibraryNodeJSTests/blobs/mainline/--/src/integration.ts
// - https://code.amazon.com/packages/ASBXGenAITools/blobs/mainline/--/src/clients/midway-http-client.ts
export async function getTenureDays(login) {
    // Validation
    validateAmazonLogin(login);
    // GET phonetool data
    const url = `https://${PHONE_TOOL_DOMAIN}/users/${login}.json`;
    return (axiosInstance
        // Step 1. GET request to the phonetool url will return a redirect to midway URL
        .get(url, {
        maxRedirects: 0, // Override to block axios's automated redirect mechanism for intercepting midway authorization
    })
        // Step 2. MCS authorize the midway URL and returns a URL with valid token
        .then(function (response) {
        if (response.status >= 300 && response.status < 400) {
            // If response is redirect
            const redirectLocation = response.headers.location;
            if (!isIdpAuthRedirect(redirectLocation)) {
                return response.request.url; // Proceed with regular redirect
            }
            else {
                const mcs = new MidwayClientSuiteLibrary();
                return (mcs
                    .authorize(redirectLocation) // MCP authorized redirect
                    .catch((error) => {
                    console.error('Error raised from MCS authorization:', error);
                    throw new Error('Unable to authorize Midway request');
                })
                    // Step 3. Send URL with valid token to phonetool url
                    .then((redirectUrl) => {
                    return axiosInstance.get(redirectUrl);
                })
                    .then(function (response) {
                    if (response.status !== 200) {
                        console.error('Error in getTenureDays:', response.status, response.statusText);
                        throw new Error('Internal server error');
                    }
                    return response.data['tenure_days'];
                })
                    .finally(() => {
                    mcs.close(); // Close the library after use
                }));
            }
        }
        else if (response.status == 200) {
            // When initial request is 200, it means the cookie is used so no redirect authorization is required
            return response.data['tenure_days'];
        }
        else {
            // Other cases are unexpected
            console.error('URL does not return an expected response:', response.status);
            throw new Error('Internal server error');
        }
    })
        .catch((error) => {
        console.error('Error in getTenureDays:', error);
        throw error;
    }));
}
// MCP tool
export const amazonTenureTool = {
    name: 'amazon-tenure',
    description: "A tool to query the Amazon tenure days of a given employee's login or alias.",
    paramSchema: {
        login: z.string(),
    },
    cb: async ({ login }) => {
        try {
            const tenureDays = await getTenureDays(login);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Tenure of ${login} is ${tenureDays} days.`,
                    },
                ],
            };
        }
        catch (error) {
            const errorMessage = error.message ?? `Unknown error: ${error}`;
            return {
                content: [
                    {
                        type: 'text',
                        text: `Unable to retrieve the tenure for ${login}: ${errorMessage}`,
                    },
                ],
                isError: true,
            };
        }
    },
};
