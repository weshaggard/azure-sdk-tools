const { SecretClient } = require("@azure/keyvault-secrets");
const { AzureCliCredential } = require("@azure/identity");

async function deletePurgeAndSetSecretWithRetry(vaultName, secretName, secretValue) {
    const client = new SecretClient(`https://${vaultName}.vault.azure.net`, new AzureCliCredential(), {
        retryOptions: {
            maxRetries: 5
        }
    });

    try {
        if (await client.getSecret(secretName)) {
            console.log(`Deleting secret: ${secretName}`);
            await client.beginDeleteSecret(secretName);
        }

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
