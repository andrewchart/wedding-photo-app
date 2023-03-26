require('dotenv').config();

const { BlobServiceClient, BlockBlobClient } = require("@azure/storage-blob");
const { DefaultAzureCredential } = require("@azure/identity");

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

    let blobOpts = { prefix: 'original' };
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

        items.forEach(item => {

            const contentType = item.properties.contentType;

            // If the content is an image and image CDN url is specified, return
            // the CDN-ized url in the response. Otherwise just return the blob url
            const baseUrl = (contentType.split('/')[0] === 'image' && imageCdnUrl) ? 
                imageCdnUrl : containerUrl;

            files.push({
                url: `${baseUrl}/${item.name}`,
                thumbnail: getThumbnailUrl(item),
                contentType
            });

        });

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

        // Set up client for the blob we're about to create
        const blockBlob = new BlockBlobClient(
            `${containerUrl}/${bucketFilename}`, 
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

// DELETE
function deletePhotos(req, res) {
    res.send({ message: "delete photos" });
}


// HELPERS
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
  
module.exports = { 
    getPhotos,
    createPhotos,
    deletePhotos
}