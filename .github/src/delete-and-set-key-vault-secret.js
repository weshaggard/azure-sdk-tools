const { SecretClient } = require("@azure/keyvault-secrets");
const { AzureCliCredential } = require("@azure/identity");

async function deletePurgeAndSetSecretWithRetry(vaultName, secretName, secretValue) {
    const client = new SecretClient(`https://${vaultName}.vault.azure.net`, new AzureCliCredential());

    try {
        console.log(`Deleting secret: ${secretName}`);
        try {
            await client.beginDeleteSecret(secretName);
        } catch (err) {
            if (err.statusCode === 404) {
                // Ignore 404 error if the secret does not exist
                console.log(`Secret ${secretName} not found, skipping delete.`);
            } else {
                throw err;
            }
        }

        console.log(`Purging secret: ${secretName}`);
        await retryOn404(() => client.purgeDeletedSecret(secretName));

        console.log(`Setting secret: ${secretName}`);
        await retryOn404(() => client.setSecret(secretName, secretValue));

        console.log(`Secret ${secretName} set successfully.`);
    } catch (err) {
        console.error("An error occurred:", err.message, "Status code:", err.statusCode || "N/A");
        throw err;
    }
}

async function retryOn404(fn, retries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (err.statusCode !== 404 || attempt === retries) {
                throw err;
            }
            console.log(`Attempt ${attempt} failed with 404. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
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
