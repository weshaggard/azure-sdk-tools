const { SecretClient } = require("@azure/keyvault-secrets");
const { AzureCliCredential } = require("@azure/identity");

async function deletePurgeAndSetSecretWithRetry(vaultName, secretName, secretValue) {
    const client = new SecretClient(`https://${vaultName}.vault.azure.net`, new AzureCliCredential());

    try {
        
        console.log(`Deleting secret: ${secretName}`);
        await ignoreNotFoundError(client.beginDeleteSecret.bind(client))(secretName);

        console.log(`Purging secret: ${secretName}`);
        await ignoreNotFoundError(() => withRetry(() => client.purgeDeletedSecret(secretName), [409]))();

        console.log(`Setting secret: ${secretName}`);
        await withRetry(() => client.setSecret(secretName, secretValue), [404, 409]);

        console.log(`Secret ${secretName} set successfully.`);
    } catch (err) {
        console.error("An error occurred:", err.message, "Status code:", err.statusCode || "N/A");
        throw err;
    }
}
function ignoreNotFoundError(operation) {
    return async function (...args) {
        try {
            return await operation(...args);
        } catch (err) {
            if (err.statusCode === 404) {
                console.log("Resource not found, ignoring 404 error.");
                return null; // Return null or handle as needed
            }
            throw err; // Rethrow other errors
        }
    };
}

async function withRetry(operation, retryableStatusCodes, maxRetries = 10) {
    let attempts = 0;

    while (attempts < maxRetries) {
        try {
            return await operation();
        } catch (err) {
            if (retryableStatusCodes.includes(err.statusCode) && attempts < maxRetries - 1) {
                attempts++;
                console.log(`Attempt ${attempts} failed with status code ${err.statusCode}. Retrying...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            } else {
                throw err; // Rethrow if not retryable or max retries reached
            }
        }
    }
}

// Read input parameters from command-line arguments
const [vaultName, secretName, secretValue] = process.argv.slice(2);

if (!vaultName || !secretName || !secretValue) {
    console.error("Usage: node delete-and-set-key-vault-secret.js <vaultName> <secretName> <secretValue>");
    process.exit(1);
}

deletePurgeAndSetSecretWithRetry(vaultName, secretName, secretValue).catch(err => {
    process.exit(1);
});
