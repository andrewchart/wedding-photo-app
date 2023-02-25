require('dotenv').config();

const { BlobServiceClient } = require("@azure/storage-blob");
const { DefaultAzureCredential } = require("@azure/identity");


// Set up clients for the blob and the container
const accountName   = process.env.AZ_STORAGE_ACCOUNT_NAME;
const containerName = process.env.AZ_STORAGE_CONTAINER_NAME;
const accountUrl    = `https://${accountName}.blob.core.windows.net`;
const containerUrl  = `${accountUrl}/${containerName}/`;

const blob = new BlobServiceClient(
    accountUrl,
    new DefaultAzureCredential()
);

const container = blob.getContainerClient(containerName);


// GET
async function getPhotos(req, res) {

    let blobOpts = {
        prefix: 'large' // Bring back the url for the large image
    }

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

        let page = await container.listBlobsFlat(blobOpts).byPage(pageOpts).next();

        let items = page.value.segment.blobItems;
        let marker = page.value.continuationToken;
        let done = (marker === '');

        let urls = [];
        items.forEach(item => urls.push(containerUrl + item.name));

        res.send({
            urls,
            nextPage: marker,
            done
        });

    } catch(error) {
        res.status(500).send({ error: "Could not retrieve photos" })
    }
    
}

// POST
function createPhotos(req, res) {
    res.send('create photos');
}

// DELETE
function deletePhotos(req, res) {
    res.send('delete photos');
}
  
module.exports = { 
    getPhotos,
    createPhotos,
    deletePhotos
}