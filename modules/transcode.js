const { AzureMediaServices } = require("@azure/arm-mediaservices");
const { BlobServiceClient, BlockBlobClient } = require("@azure/storage-blob");
const { DefaultAzureCredential } = require("@azure/identity");

const accountName = process.env.AZ_MEDIA_SERVICES_ACCOUNT_NAME;
const accountUrl    = `https://${accountName}.blob.core.windows.net`;
const containerName = process.env.AZ_STORAGE_CONTAINER_NAME;
const containerUrl  = `${accountUrl}/${containerName}`;
const resourceGroup = process.env.AZ_MEDIA_SERVICES_RESOURCE_GROUP;
const subscriptionId = process.env.AZ_MEDIA_SERVICES_SUBSCRIPTION_ID;

const transcodeClient = new AzureMediaServices(
    new DefaultAzureCredential(),
    subscriptionId
);

/**
 * Transcodes a video file based on a Transform profile from a source url
 * @param {string} url 
 * @param {string} transformName 
 * @returns 
 */
async function transcodeVideo(url, transformName = 'default') {
    try {
        const jobName = createJobName(url);

        // Check if the requested transform exists.
        let exists = await transformExists(transformName);
        
        // If not...
        if(!exists) {
            // Check if the caller asked for a specific Transform?
            // If so we don't have it, so we throw.
            if(transformName !== 'default') {
                throw new Error(
                    `Could not encode file because requested Transform does not exist.`
                );
            }

            // If we are just looking for the default Transform
            // and it doesn't exist yet, create it.
            let created = await createDefaultTransform();

            if(created) {
                // Stop and retry now the default Transform exists
                return transcodeVideo(url, 'default');
            } else {
                throw new Error(
                    `Could not encode file because the default Transform failed to create.`
                );
            }
        }

        // Create an Asset to house the output media
        await transcodeClient.assets.createOrUpdate(
            resourceGroup, 
            accountName, 
            jobName, // use job name for asset name
            {}
        );

        return await transcodeClient.jobs.create(
            resourceGroup,
            accountName,
            transformName,
            jobName,
            {
                input: {
                    odataType: '#Microsoft.Media.JobInputHttp',
                    files: [url]
                },
                outputs: [{
                    odataType: '#Microsoft.Media.JobOutputAsset',
                    assetName: jobName
                }],
                description: 'Mobile web encoding job'
            }
        );
    } catch(error) {
        return false;
    }
}

/**
 * Confirms whether a transcode job is in its finished state or not
 * @param {string} transcodeTransformName 
 * @param {string} transcodeJobName 
 * @returns {Promise}
 */
function transcodeJobCompleted(transcodeTransformName, transcodeJobName) {
    return transcodeClient.jobs.get(
        resourceGroup, 
        accountName, 
        transcodeTransformName, 
        transcodeJobName
    ).then((job) => {
        return (job.state === 'Finished');
    }).catch((error) => {
        return false;
    });
}

/**
 * Identifies the mp4 file within an asset and moves it to the 
 * public storage location so it can be served as a compressed, 
 * transcoded asset via the web. Also updates the related 
 * original file with the url of the transcoded file as metadata,
 * and cleans up the used transcode asset by deleting it.
 * @param   {string}  assetName 
 * @param   {string}  originalBlobName
 * @returns {Promise}
 */
async function moveTranscodedAsset(assetName, originalBlobName) {
    try {
        // Determine the asset container name
        const { container: assetContainerName } = await transcodeClient.assets.get(
            resourceGroup, 
            accountName, 
            assetName
        );

        // Set up clients for the blob and the two containers
        const blob = new BlobServiceClient(
            accountUrl,
            new DefaultAzureCredential()
        );

        const assetContainer = blob.getContainerClient(assetContainerName);
        const targetContainer = blob.getContainerClient(containerName);

        // Identify the transcoded video file
        let mp4Filename;
        for await (const blob of assetContainer.listBlobsFlat()) {
            if(blob.properties.contentType === 'video/mp4') {
                mp4Filename = blob.name;
                break;
            }
        }

        // Move the blob to have the same filename in the target container, 
        // but different prefix and extension. We also need the original blob.
        const transcodedBlobName = getTranscodedBlobName(originalBlobName);
        const sourceBlob = assetContainer.getBlobClient(mp4Filename);
        const targetBlob = targetContainer.getBlobClient(transcodedBlobName);
        const originalBlob = targetContainer.getBlobClient(originalBlobName);

        const { copyStatus } = await targetBlob.syncCopyFromURL(sourceBlob.url);

        if(copyStatus !== 'success') throw new Error('Copy of transcoded asset failed!');

        // Copy successful, so tag the original file metadata
        originalBlob.setMetadata({ 
            transcodedUrl: `${containerUrl}/${transcodedBlobName}`
        });

        // Delete the asset
        transcodeClient.assets.delete(resourceGroup, accountName, assetName);

    } catch(error) {
        console.log(error);
    }
}

// HELPERS

/**
 * Creates a default Transform in Azure Media Services to 
 * be able to process jobs. The profile produces a general
 * purpose H264 output for mobile web streaming.
 */
function createDefaultTransform() {
    const defaultTransformName = 'default';
    const defaultTransformDesc = 
        `Default Transform profile to encode 
         videos to a compressed MP4 format 
         for direct streaming.`;

    return transcodeClient.transforms.createOrUpdate(
        resourceGroup, 
        accountName, 
        defaultTransformName,
        {
            description: defaultTransformDesc,
            outputs: [{
                onError: 'StopProcessingJob',
                preset: {
                    odataType: '#Microsoft.Media.BuiltInStandardEncoderPreset',
                    configurations: { 
                        complexity: 'Speed'
                    },
                    presetName: 'H264SingleBitrate720p'
                },
                relativePriority: 'Normal'
            }]
        }
    ).then((result) => {
        return true; // created
    }).catch((error) => {
        return false; // failed
    });
}

/**
 * Checks if a Transform exists with the given name.
 * @param   {string}  transformName 
 * @returns {boolean|undefined}
 */
function transformExists(transformName) {
    return transcodeClient.transforms.get(
        resourceGroup, 
        accountName, 
        transformName
    ).then((result) => {
        if(result.type === 'Microsoft.Media/mediaservices/transforms') {
            return true;
        } else {
            return undefined; // unexpected result
        }
    }).catch((error) => {
        if(error.statusCode === 404) {
            return false; // we know it doesn't exist
        } else {
            return undefined; // we don't know if it exists
        }
    });
}

/**
 * Creates a name for the transcode job based on 
 * the input filename.
 * @param {string} url 
 */
function createJobName(url) {
    return url.substring(url.lastIndexOf('/') + 1).split('.')[0];
}

/**
 * Defines the algorithm for relating the storage bucket 
 * name of a transcoded video asset compared to the 
 * name of the original video asset. I.e. replace folder 
 * prefix and file extension.
 * @param {string} originalName
 */
function getTranscodedBlobName(originalName) {
    return originalName
        .replace(/^original\//, 'transcoded/')
        .replace(/[^\.]*$/, 'mp4');
}

module.exports = {
    getTranscodedBlobName,
    moveTranscodedAsset,
    transcodeJobCompleted,
    transcodeVideo
}