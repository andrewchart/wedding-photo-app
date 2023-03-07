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
    let pageSize = ((pageSizeFromQuery > 0) ? pageSizeFromQuery : 2);
    let pageMarker = req.query.pageMarker || undefined;

    let pageOpts = { 
        maxPageSize: pageSize,
        continuationToken: pageMarker  // undefined for first page
    }

    // Get and parse the response data
    try {

        let page = await container.listBlobsFlat().byPage(pageOpts).next();

        let items = page.value.segment.blobItems;
        let marker = page.value.continuationToken;
        let done = (marker === '');

        let files = [];

        items.forEach(item => {

            const contentType = item.properties.contentType;

            // If the content is an image and image CDN url is specified, return
            // the CDN-ized url in the response. Otherwise just return the blob url
            const baseUrl = (contentType.split('/')[0] === 'image' && imageCdnUrl) ? 
                imageCdnUrl : 
                containerUrl;

            files.push({
                url: `${baseUrl}/${item.name}`,
                contentType
            });

        });

        res.send({
            files,
            nextPage: marker,
            done
        });

    } catch(error) {
        res.status(500).send({ error: "Could not retrieve photos" });
    }
    
}

// POST
function createPhotos(req, res) {

    try {

        const contentType = req.headers["content-type"];
        const originalFilename = req.query.originalFilename.split(".")[0];
        const descendingIndex = Number.MAX_SAFE_INTEGER - Date.now();
        const extension = getExtensionFromContentType(contentType);
        const bucketFilename = `${descendingIndex}-${originalFilename}.${extension}`; 

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
        );
        
        req.on('end', () => {
            res.status(201).send({ message: "Photos uploaded successfully!" });
        });
        
    } catch(error) {
        res.status(500).send({ error: "Could not upload photos." });
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

  
module.exports = { 
    getPhotos,
    createPhotos,
    deletePhotos
}