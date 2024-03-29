require('dotenv').config();

const { BlobServiceClient, BlockBlobClient } = require("@azure/storage-blob");
const { DefaultAzureCredential } = require("@azure/identity");
const { 
    getTranscodedBlobName, 
    moveTranscodedAsset,
    transcodeJobCompleted, 
    transcodeVideo 
} = require('../modules/transcode.js');

const accountName   = process.env.AZ_STORAGE_ACCOUNT_NAME;
const containerName = process.env.AZ_STORAGE_CONTAINER_NAME;
const accountUrl    = `https://${accountName}.blob.core.windows.net`;
const containerUrl  = `${accountUrl}/${containerName}`;
const imageCdnUrl   = process.env.IMAGE_CDN_BASE_URL;

// GET
async function getPhotos(req, res) {

    // Set up clients for the blob, the container
    const blob = new BlobServiceClient(
        accountUrl,
        new DefaultAzureCredential()
    );

    const container = blob.getContainerClient(containerName);

    // Pagination options
    let pageSizeFromQuery = parseInt(req.query.pageSize);
    let pageSize = ((pageSizeFromQuery > 0) ? pageSizeFromQuery : 1);
    let pageMarker = req.query.pageMarker || undefined;

    let blobOpts = { 
        prefix: 'original',
        includeMetadata: true
    }

    let pageOpts = { 
        maxPageSize: pageSize,
        continuationToken: pageMarker  // undefined for first page
    }

    // Get and parse the response data
    try {
        let page = await container.listBlobsFlat(blobOpts).byPage(pageOpts).next();

        let items = page.value.segment.blobItems;
        let marker = page.value.continuationToken;
        let done = (marker === '');

        let files = [];
        let promises = [];

        items.forEach((item, index) => {

            let promise = new Promise(async (resolve) => {
                const contentType = item.properties.contentType;

                // If the content is an image and image CDN url is specified, return
                // the CDN-ized url in the response. Otherwise just return the blob url
                const baseUrl = (contentType.split('/')[0] === 'image' && imageCdnUrl) ? 
                    imageCdnUrl : containerUrl;

                // If the content is a video, we'll check if the file has metadata 
                // with the key `transcodedUrl`. If it does, this indicates a transcoded
                // version of the video is available, and its url can be returned
                let transcodedUrl;
                if(contentType.split('/')[0] === 'video') {
                    transcodedUrl = await getTranscodedUrl(item);
                }

                // Meta tags and people tags for this photo
                const { metaTags, peopleTags } = item.metadata;

                files[index] = {
                    url: `${baseUrl}/${item.name}`,
                    transcodedUrl,
                    thumbnail: getThumbnailUrl(item),
                    contentType,
                    metaTags,
                    peopleTags
                };

                resolve(true);
            });
            
            promises.push(promise);

        });
        
        await Promise.all(promises);

        res.status(200).send({
            files,
            nextPage: marker,
            done
        });
        
    } catch(error) {
        res.status(500).send({
            message: 'Internal Server Error',
            details: 'Could not retrieve photos.'
        });
    }
}

// POST
function createPhotos(req, res) {

    try {

        const contentType = req.headers["content-type"];
        const extension = getExtensionFromContentType(contentType);
        const nakedFilename = req.query.targetFilename.split(".")[0];
        const bucketFilename = `${nakedFilename}.${extension}`; 
        const bucketUrl = `${containerUrl}/${bucketFilename}`;

        // Set up client for the blob we're about to create
        const blockBlob = new BlockBlobClient(
            bucketUrl, 
            new DefaultAzureCredential()
        );
        
        // Stream the original to blob storage immediately, 
        // passing thru Content-Type
        blockBlob.uploadStream(
            req, 
            8 * 1024 * 1024, //bufferSize: 8MB (Default)
            2,               //maxConcurrency
            { blobHTTPHeaders: { blobContentType: contentType } }
        ).then(() => {
            // Create a transcode job for the video and tag the original
            // file with the asset name so progress can be checked later
            if(contentType.split('/')[0] === 'video') {
                const transcodeTransformName = 'default';

                transcodeVideo(bucketUrl, transcodeTransformName).then((job) => {
                    if(!job) throw new Error('Failed to create transcode job');
                    blockBlob.setMetadata({ 
                        transcodeJobName: job.name,
                        transcodeTransformName
                    });
                }).catch((error) => {
                    console.log(error);
                });
            }

            res.status(201).send({ 
                message: 'OK',
                details: 'Files uploaded successfully!' 
            });
        }).catch((error) => {
            res.status(400).send({ 
                message: 'Bad Request', 
                details: 'Could not upload files.' 
            });
        });
        
    } catch(error) {
        res.status(500).send({ 
            message: 'Internal Server Error', 
            details: 'Could not upload photos.' 
        });
    }
   
}

// PATCH
function patchPhotos(req, res) {
    if(!req.body.files) {
        return res.status(400).send({ 
            message: 'Bad Request', 
            details: 'No files supplied.' 
        });
    }

    let outcomes = {
        completed: [],
        failed: [...req.body.files] // assume files haven't been updated
    }

    if(req.body.password !== process.env.WPA_MANAGE_PASSWORD) {
        res.status(401).send({ 
            message: 'Unauthorized', 
            details: 'Password does not match.', 
            outcomes    
        });
    } else {
        let patchOperations = [];

        // Loop through each file and move from 'failed' to 
        // 'completed' if the PATCH succeeds.
        outcomes.failed.forEach((file, i) => {

            const blockBlob = new BlockBlobClient(
                `${containerUrl}/${file.name}`, 
                new DefaultAzureCredential()
            );
            
            // Currently we're only handling PATCHing metadata, not the blob itself
            if(!file.metadata) return;
            let patchOp = blockBlob.setMetadata(file.metadata).then((result) => {
                if(!result.errorCode) {
                    outcomes.completed.push(file);
                    delete outcomes.failed[i];
                }
            }).catch((error) => {
                console.log(error);
                // Do nothing - the patch failed
            });

            patchOperations.push(patchOp);
        });

        Promise.all(patchOperations).then(() => {
            outcomes.failed = outcomes.failed.flat();

            if(outcomes.completed.length < req.body.files.length) {
                throw new Error('Not all files were updated');
            }

            res.status(200).send({ 
                message: 'OK',
                details: 'All photos updated',
                outcomes
            });
        }).catch((error) => {
            res.status(500).send({ 
                message: 'Internal Server Error',
                details: 'Not all files were updated',
                outcomes
            });
        });   
    }
}

// DELETE
function deletePhotos(req, res) {
    if(!req.body.files) {
        return res.status(400).send({ 
            message: 'Bad Request', 
            details: 'No files supplied.' 
        });
    }

    let outcomes = {
        completed: [],
        failed: [...req.body.files] // assume files haven't been deleted
    }

    if(req.body.password !== process.env.WPA_MANAGE_PASSWORD) {
        res.status(401).send({ 
            message: 'Unauthorized', 
            details: 'Password does not match.', 
            outcomes    
        });
    } else {
        let container;
        let deleteOperations = [];

        try {
            // Set up client for the blob service and container
            const blob = new BlobServiceClient(
                accountUrl,
                new DefaultAzureCredential()
            );

            container = blob.getContainerClient(containerName);
        } catch(error) {
            res.status(500).send({ 
                message: 'Internal Server Error',
                details: 'Not all files were deleted',
                outcomes
            });
        }

        // Loop through each file and move from 'failed' to 
        // 'completed' if the DELETE succeeds.
        outcomes.failed.forEach((file, i) => {
            let deleteOp = container.deleteBlob(file.name).then((result) => {
                if(!result.errorCode) {
                    outcomes.completed.push(file);
                    delete outcomes.failed[i];
                }
            }).catch((error) => {
                // Do nothing - the delete failed
            });

            deleteOperations.push(deleteOp);
        });

        Promise.all(deleteOperations).then(() => {
            outcomes.failed = outcomes.failed.flat();

            if(outcomes.completed.length < req.body.files.length) {
                throw new Error('Not all files were deleted');
            }

            res.status(200).send({ 
                message: 'OK',
                details: 'All photos deleted',
                outcomes
            });
        }).catch((error) => {
            res.status(500).send({ 
                message: 'Internal Server Error',
                details: 'Not all files were deleted',
                outcomes
            });
        });   
    }
}


// HELPERS

/**
 * Takes the content-type metadata of a file and returns a
 * reasonable extension for the file.
 * @param   {string} contentType 
 * @returns {string}
 */
function getExtensionFromContentType(contentType) {

    const suffix = contentType.split("/")[1];
    
    switch(suffix) {
        
        case 'heic':
            return 'HEIC';
        
        case 'jpeg':
            return 'jpg';
            
        case 'quicktime':
            return 'mov';

        default:
            return suffix;
    }

}

/**
 * Works out the url of the thumbnail image displayed in
 * the photo gallery.
 * @param   {object} item 
 * @returns {string}
 */
function getThumbnailUrl(item) {
    const baseUrl = (imageCdnUrl || containerUrl);
    const videoThumbs = { base: 'video_thumbnails', extension: 'jpg' };
    let url;

    switch(item.properties.contentType.split('/')[0]) {
        case 'image':
            url = `${baseUrl}/${item.name}`;
            break;
            
        case 'video': 
            let thumbFilename = item.name.replace(
                /[^\.]*$/, //capture everything after last '.' in filename
                videoThumbs.extension
            ).replace(
                /^original\//gi, //remove the filename's 'original' prefix
                videoThumbs.base + '/'
            );
            url = `${baseUrl}/${thumbFilename}`;
            break;

        default: 
            break;
    }

    return url;
}

/**
 * When a video file has just been uploaded a transcode job
 * is generated to convert it to a limited bitrate format. 
 * This function runs when the object is constructed for the
 * GET API and either returns the transcoded url if was 
 * previously confirmed (i.e. url exists within the original
 * file's metadata), or if the metadata isn't present, the 
 * function will check the transcode job to see if it's 
 * finished, and if it is return the transcoded url. Other
 * scenarios return undefined and result in the front end
 * displaying a "this video is still processing" message.
 * @param   {object} item 
 * @returns {string|undefined}
 */
async function getTranscodedUrl(item) {
    return new Promise(async (resolve) => {
        if(!item.metadata) resolve();

        const { transcodeJobName, transcodeTransformName, transcodedUrl } = item.metadata;

        // If the `transcodedUrl` metadata key exists, return it directly
        if(transcodedUrl) resolve(transcodedUrl);

        // Otherwise, check if the file is tagged with Transcode Job
        // metadata. If so, this can be used to check the progress of the 
        // transcode job and update the `transcodedUrl` metadata if the 
        // job has now completed. 
        if(transcodeTransformName && transcodeJobName) {
            const jobComplete = await transcodeJobCompleted(transcodeTransformName, transcodeJobName); 

            if(jobComplete) {
                moveTranscodedAsset(
                    transcodeJobName,  // Earlier we made assetName == jobName
                    item.name
                );

                // Optimistically return the transcoded item url even 
                // though move may not be complete
                resolve(`${containerUrl}/${getTranscodedBlobName(item.name)}`);
            }
        }
        
        // If there is no transcoded url, and the job is not complete
        // we return nothing and the transcoded url will not be included
        // with the API response
        resolve();
    });
}
  
module.exports = { 
    getPhotos,
    createPhotos,
    patchPhotos,
    deletePhotos
}