const galleryElement = document.getElementById('gallery');
const spinnerElement = document.getElementById('spinner');
const refreshLinkElement = document.getElementById('refreshLink');
const galleryItemTemplate = document.getElementById('galleryItem').content;
const uploadBtnElement = document.getElementById('uploadBtn');
const imageFilesElement = document.getElementById('imageFiles');
const uploadFeedbackElement = document.getElementById('uploadFeedback');
const uploadProgressElement = uploadFeedbackElement.querySelector('progress');
const uploadMessageElement  = uploadFeedbackElement.querySelector('#uploadFeedbackMsg');
const toastElement = document.getElementById('toast');
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
                let linkElement = galleryItem.querySelector('a');
                let contentType = file.contentType.split('/')[0];
                let media;

                switch(contentType) {
                    case 'image': 
                        media = new Image();
                        media.src = getThumbnailUrl(file.url);
                        break;
                    
                    case 'video':
                        media = document.createElement('video');
                        media.src = file.url;
                        media.preload = "metadata";
                        break;

                    default:
                        console.warn('Unrecognised media. Will not display in gallery.');
                        return;
                }

                galleryItem.querySelector('li').classList.add(contentType);
                linkElement.href = getLightboxUrl(file.url);
                linkElement.dataset.type = contentType;
                linkElement.appendChild(media);
                
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
            refreshFsLightbox();
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

function setRefreshMessages(message, action) {
    document.querySelector('#refreshLink .message').innerHTML = message;
    document.querySelector('#refreshLink .action').innerHTML = action;
}

function showRefreshLink() {
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

function uploadFiles(event) {
    const files = event.target.files;
    const numFiles = files.length;

    if(numFiles === 0) return;

    let fetches = [];
    let controllers = [];

    let outcomes = {
        completed: 0,
        failed: 0
    }

    updateUploadFeedback(`0 of ${numFiles} completed...`);

    showUploadFeedback();

    for(let i = 0; i < numFiles; i++) {

        let { 
            upload,
            controller 
        } = queueFileUpload(files[i]);

        fetches.push(upload);

        controllers.push(controller);

        upload.then((success) => {
            if(success) {
                outcomes["completed"]++;
                updateUploadFeedback(`${outcomes.completed} of ${numFiles} completed...`);
            } else {
                outcomes["failed"]++;
            }
        });

    }

    // User cancellation of fetches
    cancelUploadElement.onclick = cancelUpload(controllers);

    // When all fetches are done...
    Promise.all(fetches).then(() => {
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
            toastMessage( getUploadCompleteMessage(outcomes) );
        }, 1500);
    });
}

function queueFileUpload(file) {
    let originalFilename = encodeURIComponent(file.name);

    let controller = new AbortController();

    let upload = fetch(`/api/photos?originalFilename=${originalFilename}`, {
        method: 'POST',
        body: file,
        headers: {
            "Content-Type": file.type
        },
        signal: controller.signal
    })
    
    .then((response) => {
        if(Math.floor(response.status/100) === 2) {
            return true;
        } else {
            throw new Error(`Upload of file ${originalFilename} to blob storage failed`);
        }
    })
    
    .catch((error) => {
        if(error.name != 'AbortError') {
            console.error(error);
        }
        return false;
    });

    return { 
        upload,
        controller
    }
}

function cancelUpload(controllers) {
    return (event) => {
        event.preventDefault();
        uploadMessageElement.textContent = 'Cancelling...';
        controllers.forEach(controller => controller.abort());
    }
}

function getUploadCompleteMessage(outcomes) {
        let uploadCompleteMessage = '';

        // Update message
        uploadCompleteMessage += (outcomes.completed > 0) ? 
            `✅ ${outcomes.completed} files uploaded successfully. ` : '';

        uploadCompleteMessage += (outcomes.failed > 0) ? 
            `❌ ${outcomes.failed} files failed, please try again.` : '';

        return uploadCompleteMessage;
}

function updateUploadFeedback(message = '') {
    uploadMessageElement.textContent = message;
}

function showUploadFeedback() {
    document.body.classList.add('locked');
    uploadFeedbackElement.classList.remove('hidden');
}

function hideUploadFeedback() {
    document.body.classList.remove('locked');
    uploadFeedbackElement.classList.add('hidden');
}

function toastMessage(message) {
    
    toastElement.querySelector('.message').textContent = message;

    toastElement.classList.add('active');

    setTimeout(() => {
        toastElement.classList.remove('active');
    }, 3000);
}

function getLightboxUrl(largeUrl) {
    return largeUrl + '?q=65&h=1080';
}

/* Event handlers */
document.addEventListener('DOMContentLoaded', () => {
    renderPhotoThumbnails();
});

document.addEventListener('scroll', loadMoreOnScroll);

var throttleTimer;

function throttle(callback, time) {
    if(throttleTimer) return;
    
    throttleTimer = setTimeout(() => {
        callback();
        throttleTimer = false;
    }, time);
};

uploadBtnElement.addEventListener('click', (event) => {
    event.preventDefault();
    imageFilesElement.click();
});

imageFilesElement.onchange = (event) => {
    uploadFiles(event);
}

refreshLinkElement.onclick = (event) => {
    event.preventDefault();
    refreshLinkElement.classList.add('hidden');
    refreshPhotoThumbnails();
}
