// HTML Elements
const galleryElement = document.getElementById('gallery');
const spinnerElement = document.getElementById('spinner');
const galleryItemTemplate = document.getElementById('galleryItem').content;
const uploadFeedbackElement = document.getElementById('uploadFeedback');
const uploadProgressElement = uploadFeedbackElement.querySelector('progress');
const uploadMessageElement  = uploadFeedbackElement.querySelector('#uploadFeedbackMsg');


function renderPhotoThumbnails(pageSize = 12) {

    let pageMarker = galleryElement.dataset.nextPage || "";
    
    if(galleryElement.dataset.done === "true") return;

    // Start spinner & mark window to say a fetch is in progress
    spinnerElement.classList.remove('hidden');
    window.fetchIsRunning = true;

    fetch(`/api/photos?pageSize=${pageSize}&pageMarker=${pageMarker}`)

        .then(response => {
            if(Math.floor(response.status/100) === 2) {
                return response.json();
            } else {
                throw new Error('Fetch of photo urls from blob storage failed');
            }
        })

        .then(data => {

            // Set the next page marker for the next reload
            galleryElement.dataset.nextPage = data.nextPage;

            // If there is no more data, stop further reloads
            // until the user specifies
            galleryElement.dataset.done = (data.done ? "true" : "false");
    
            // Populate the gallery
            data.files.forEach(file => {
                let galleryItem = galleryItemTemplate.cloneNode(true);

                galleryItem.querySelector('a').href = file.url;
                galleryItem.querySelector('img').src = getThumbnailUrl(file.url);
                
                galleryElement.append(galleryItem);

            });

            // If the gallery is now done, show a message
            if(galleryElement.dataset.done === "true") {

                setRefreshMessages(
                    "No more photos to show.",
                    "Refresh to see newer photos"
                );

                showRefreshLink();
                
            };

        })

        .catch(() => {

            setRefreshMessages(
                "Sorry, an error has occured.",
                "Tap here to try again"
            );

            showRefreshLink();

            galleryElement.dataset.done = "true";

        })

        .finally(() => {
            spinnerElement.classList.add('hidden');
            window.fetchIsRunning = false;
        });

};


function loadMoreOnScroll() {

    throttle(() => {

        if(window.innerHeight + window.pageYOffset >= document.body.offsetHeight) {
            if(window.fetchIsRunning) return;
            renderPhotoThumbnails(2);
        };

    }, 500);
    
}


function refreshPhotoThumbnails() {

}

function uploadPhotos(event) {
    
    const files = event.target.files;
    const numFiles = files.length;

    if(numFiles === 0) return;

    showUploadFeedback();

    for(let currFile = 0; currFile < files.length; currFile++) {
        
        let message = `Uploading file ${currFile + 1} of ${numFiles}...`;
        uploadMessageElement.innerHTML = message;
        let originalFilename = encodeURIComponent(files[currFile].name);

        fetch(`/api/photos?originalFilename=${originalFilename}`, {
            method: 'POST',
            body: files[currFile],
            headers: {
                "Content-Type": files[currFile].type
            },
        });

    }
    
    
    // .then(response => {
    //     if(Math.floor(response.status/100) === 2) {
    //         return response.json();
    //     } else {
    //         throw new Error('Fetch of photo urls from blob storage failed');
    //     }
    // })

    // .then(data => {
    //     if(data.status===500) throw new Error(data.error);
    // })

    // .catch((error) => {
    //     uploadMessageElement.innerHTML = `Could not upload your photos, please
    //                                       close this window and try again`;
    // });

}

function cancelUpload() {
    // TODO: Check for running fetches
    hideUploadFeedback();
}


/* Utility functions */
function setRefreshMessages(message, action) {
    document.querySelector('#refreshLink .message').innerHTML = message;
    document.querySelector('#refreshLink .action').innerHTML = action;
}

function showRefreshLink() {
    let refreshLinkElement = document.getElementById('refreshLink');
    if(refreshLinkElement && refreshLinkElement.classList.contains('hidden')) {
        refreshLinkElement.classList.remove('hidden');
    }
}

function getThumbnailUrl(largeUrl) {
    return largeUrl.replace("/large/","/thumbnails/");
}

function showUploadFeedback() {
    document.body.classList.add('locked');
    document.getElementById('uploadFeedback').classList.remove('hidden');
}

function hideUploadFeedback() {
    document.body.classList.remove('locked');
    document.getElementById('uploadFeedback').classList.add('hidden');
}

// Scroll event throttling
var throttleTimer;

function throttle(callback, time) {
    if(throttleTimer) return;
    
    throttleTimer = setTimeout(() => {
        callback();
        throttleTimer = false;
    }, time);
};


/* Event handlers */
document.addEventListener('DOMContentLoaded', renderPhotoThumbnails(2));
document.addEventListener('scroll', loadMoreOnScroll);

document.getElementById('uploadBtn').onclick = () => {
    document.getElementById('imageFiles').click();
}

document.getElementById('imageFiles').onchange = (event) => {
    uploadPhotos(event);
}

document.getElementById('cancelUpload').onclick = (event) => {
    event.preventDefault();
    cancelUpload();
}
