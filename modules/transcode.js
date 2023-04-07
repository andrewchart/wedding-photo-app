const { AzureMediaServices } = require("@azure/arm-mediaservices");
const { DefaultAzureCredential } = require("@azure/identity");

const accountName = process.env.AZ_MEDIA_SERVICES_ACCOUNT_NAME;
const resourceGroup = process.env.AZ_MEDIA_SERVICES_RESOURCE_GROUP;
const subscriptionId = process.env.AZ_MEDIA_SERVICES_SUBSCRIPTION_ID;

const transcodeClient = new AzureMediaServices(
    new DefaultAzureCredential(),
    subscriptionId
);

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
                description: 'job description'
            }
        );
    } catch(error) {
        return false;
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

module.exports = transcodeVideo;