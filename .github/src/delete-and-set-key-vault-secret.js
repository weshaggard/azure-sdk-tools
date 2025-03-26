const { SecretClient } = require("@azure/keyvault-secrets");
const { DefaultAzureCredential } = require("@azure/identity");

async function deletePurgeAndSetSecretWithRetry(vaultName, secretName, secretValue) {
    const credential = new AzureCliCredential();
    const url = `https://${vaultName}.vault.azure.net`;

    const clientOptions = {
        retryOptions: {
            maxRetries: 3,
            retryDelayInMs: 1000,
            maxRetryDelayInMs: 4000,
        }
    };

    const client = new SecretClient(url, credential, clientOptions);

    try {
        console.log(`Deleting secret: ${secretName}`);
        await client.beginDeleteSecret(secretName);

        console.log(`Purging secret: ${secretName}`);
        await client.purgeDeletedSecret(secretName);

        console.log(`Setting secret: ${secretName}`);
        await client.setSecret(secretName, secretValue);

        console.log(`Secret ${secretName} set successfully.`);
    } catch (err) {
        console.error("An error occurred:", err.message);
        throw err;
    }
}

// Read input parameters from command-line arguments
const [vaultName, secretName, secretValue] = process.argv.slice(2);

if (!vaultName || !secretName || !secretValue) {
    console.error("Usage: node delete-and-set-key-vault-secret.js <vaultName> <secretName> <secretValue>");
    process.exit(1);
}

deletePurgeAndSetSecretWithRetry(vaultName, secretName, secretValue).catch(err => {
    console.error("An error occurred:", err.message);
    process.exit(1);
});
