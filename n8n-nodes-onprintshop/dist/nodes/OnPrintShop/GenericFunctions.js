"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.opsRequest = exports.getAccessToken = void 0;
const n8n_workflow_1 = require("n8n-workflow");
/**
 * Get OAuth2 access token for OnPrintShop
 */
async function getAccessToken() {
    const credentials = await this.getCredentials('onPrintShopApi');
    const tokenUrl = credentials.tokenUrl || 'https://api.onprintshop.com/oauth/token';
    const clientId = credentials.clientId;
    const clientSecret = credentials.clientSecret;
    try {
        const tokenResponse = await this.helpers.request({
            method: 'POST',
            url: tokenUrl,
            headers: {
                'Content-Type': 'application/json',
            },
            body: {
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret,
            },
            json: true,
        });
        return tokenResponse.access_token;
    }
    catch (error) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Failed to get access token: ${error.message}`);
    }
}
exports.getAccessToken = getAccessToken;
/**
 * Make a GraphQL request to OnPrintShop
 */
async function opsRequest(query, variables = {}) {
    const credentials = await this.getCredentials('onPrintShopApi');
    const baseUrl = credentials.baseUrl || 'https://api.onprintshop.com';
    const accessToken = await getAccessToken.call(this);
    try {
        const responseData = await this.helpers.request({
            method: 'POST',
            url: `${baseUrl}/api/`,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: {
                query: query.trim(),
                variables,
            },
            json: true,
        });
        if (responseData.errors) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `GraphQL Error: ${JSON.stringify(responseData.errors)}`);
        }
        return responseData;
    }
    catch (error) {
        if (error instanceof n8n_workflow_1.NodeOperationError) {
            throw error;
        }
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `API Request Error: ${error.message}`);
    }
}
exports.opsRequest = opsRequest;
