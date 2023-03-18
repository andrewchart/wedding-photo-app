// HTML Elements
const galleryElement = document.getElementById('gallery');
const spinnerElement = document.getElementById('spinner');
const refreshLink = document.getElementById('refreshLink');
const galleryItemTemplate = document.getElementById('galleryItem').content;
const uploadFeedbackElement = document.getElementById('uploadFeedback');
const uploadProgressElement = uploadFeedbackElement.querySelector('progress');
const uploadMessageElement  = uploadFeedbackElement.querySelector('#uploadFeedbackMsg');
const cancelUploadElement = document.getElementById('cancelUpload');

function renderPhotoThumbnails(pageSize = 2, specificPage = undefined, prepend = false) {

    let pageMarker;

    if(typeof specificPage === "undefined") {
        pageMarker = galleryElement.dataset.nextPage || "";
    } else {
        pageMarker = specificPage;
    }
    
    if(galleryElement.dataset.done === "true" && prepend === false) return;

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
            // unless the caller asked for a specific page
            // in which case the gallery's "nextPage" and 
            // "done" state remains untouched.
            if(typeof specificPage === "undefined") {
                galleryElement.dataset.nextPage = data.nextPage;

                // If there is no more data, stop further reloads
                // until the user specifies
                galleryElement.dataset.done = (data.done ? "true" : "false");
            }
    
            // Populate the gallery
            data.files.forEach(file => {
                
                let galleryItem = galleryItemTemplate.cloneNode(true);

                galleryItem.querySelector('a').href = getLightboxUrl(file.url);
                galleryItem.querySelector('img').src = getThumbnailUrl(file.url);
                
                if(prepend) {
                    galleryElement.prepend(galleryItem);
                } else {
                    galleryElement.append(galleryItem);
                }

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
            renderPhotoThumbnails();
        };

    }, 500);
    
}

function refreshPhotoThumbnails() {
    galleryElement.replaceChildren();
    galleryElement.dataset.done = "false";
    galleryElement.dataset.nextPage = "";
    renderPhotoThumbnails();
}

function uploadPhotos(event) {
    
    const files = event.target.files;
    const numFiles = files.length;

    if(numFiles === 0) return;

    let fetches = [];
    let controllers = [];

    let outcomes = {
        completed: 0,
        failed: 0
    }

    let message = `${outcomes.completed} of ${numFiles} completed...`;
    uploadMessageElement.textContent = message;

    showUploadFeedback();

    for(let i = 0; i < numFiles; i++) {
        
        let originalFilename = encodeURIComponent(files[i].name);

        let controller = new AbortController();

        let upload = fetch(`/api/photos?originalFilename=${originalFilename}`, {
            method: 'POST',
            body: files[i],
            headers: {
                "Content-Type": files[i].type
            },
            signal: controller.signal
        })
        
        .then((response) => {
            if(Math.floor(response.status/100) === 2) {
                outcomes['completed']++;
                let message = `${outcomes.completed} of ${numFiles} completed...`;
                uploadMessageElement.textContent = message;
                return response.json();
            } else {
                throw new Error(`Upload of file ${i+1} to blob storage failed`);
            }
        })
        
        .catch((error) => {
            outcomes['failed']++;
            if(error.name == 'AbortError') return;
            console.error(error);
        });

        fetches.push(upload);
        controllers.push(controller);

    }

    // User cancellation of fetches
    cancelUploadElement.onclick = cancelUpload(controllers);

    // When all fetches are done...
    let uploadCompleteMessage = '';

    Promise.all(fetches).then((responses) => {
        
        // Update message
        uploadCompleteMessage += (outcomes.completed > 0) ? 
            `✅ ${outcomes.completed} files uploaded successfully. ` : '';

        uploadCompleteMessage += (outcomes.failed > 0) ? 
            `❌ ${outcomes.failed} files failed, please try again.` : '';

        if(outcomes.completed > 0) {
            setTimeout(() => {
                renderPhotoThumbnails(outcomes.completed, "", true);
            }, 4000);
        }

    })
    
    .catch((error) => {
        console.error(error);
    })
    
    .finally(() => {
        // Prevents flashing and ensures modal actually shows on Safari
        setTimeout(() => {
            hideUploadFeedback();
            toastMessage(uploadCompleteMessage);
        }, 1500);
    });

}

function cancelUpload(controllers) {
    return (event) => {
        event.preventDefault();
        uploadMessageElement.textContent = 'Cancelling...';
        controllers.forEach(controller => controller.abort());
    }
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
    const dpr = (window.devicePixelRatio || 1);
    let h = 195 * dpr;
    let max_w = 260 * dpr;
    return largeUrl + `?q=44&fit=crop&crop=top,faces&h=${h}&max-w=${max_w}`;
}

function getLightboxUrl(largeUrl) {
    return largeUrl + '?q=65&h=1080';
}

function showUploadFeedback() {
    document.body.classList.add('locked');
    document.getElementById('uploadFeedback').classList.remove('hidden');
}

function hideUploadFeedback() {
    document.body.classList.remove('locked');
    document.getElementById('uploadFeedback').classList.add('hidden');
}

function toastMessage(message) {
    const toast = document.getElementById('toast');

    toast.querySelector('.message').textContent = message;

    toast.classList.add('active');

    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
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
document.addEventListener('DOMContentLoaded', renderPhotoThumbnails);
document.addEventListener('scroll', loadMoreOnScroll);

document.getElementById('uploadBtn').addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('imageFiles').click();
});

document.getElementById('imageFiles').onchange = (event) => {
    uploadPhotos(event);
}

refreshLink.onclick = (event) => {
    event.preventDefault();
    refreshLink.classList.add('hidden');
    refreshPhotoThumbnails();
}
