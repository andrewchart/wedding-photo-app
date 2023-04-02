const galleryElement = document.getElementById('gallery');
const spinnerElement = document.getElementById('spinner');
const refreshLinkElement = document.getElementById('refreshLink');
const galleryItemTemplate = document.getElementById('galleryItem').content;
const uploadBtnElement = document.getElementById('uploadBtn');
const imageFilesElement = document.getElementById('imageFiles');
const uploadFeedbackElement = document.getElementById('uploadFeedback');
const uploadMessageElement  = document.getElementById('uploadFeedbackMsg');
const toastElement = document.getElementById('toast');
const cancelUploadElement = document.getElementById('cancelUpload');

function renderPhotoThumbnails(
    pageSize = parseInt(galleryElement.dataset.pageSize) || 8, 
    specificPage = undefined, 
    prepend = false
) {
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
            data.files.forEach((file, i) => {
                
                let contentType = file.contentType.split('/')[0];
                let lightboxContentType = (contentType === 'video' ? 
                    'customVideo' : contentType);

                let galleryItem = galleryItemTemplate.cloneNode(true);
                
                // For the manage page, tag each gallery element with the 
                // storage bucket file path
                let bucketPathElement = galleryItem.querySelector('.bucketPath');

                if(bucketPathElement) {
                    let bucketPath = new URL(file.url).pathname
                        .replace(/^(\/wedding-photo-app)?\/original/, 'original');
                        
                    bucketPathElement.innerText = bucketPath;
                    galleryItem.querySelector('li').dataset.bucketPath = bucketPath;
                }
                
                let linkElement = galleryItem.querySelector('a');

                let thumb = new Image();
                thumb.src = getThumbnailUrl(file);
                thumb.onerror = replaceThumbnailWithPlaceholder;

                let videoTemplate, media;

                switch(contentType) {
                    case 'image':
                        linkElement.href = getLightboxUrl(file);
                        break;

                    case 'video': 
                        videoTemplate = document.createElement('template');
                        media = document.createElement('video');
                        media.src = getLightboxUrl(file);
                        media.controls = true;
                        media.poster = getThumbnailUrl(file);
                        media.preload = 'none';
                        media.id = `video${i}`;
                        linkElement.href = `#video${i}`; 
                        videoTemplate.appendChild(media);
                        break;

                    default:
                        console.warn('Unrecognised media. Will not display in gallery.');
                        return;
                }

                linkElement.dataset.type = lightboxContentType;
                linkElement.appendChild(thumb);
                if(videoTemplate) linkElement.appendChild(videoTemplate); 
                
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
            refreshLightbox();
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

function getThumbnailUrl(file) {
    const dpr = (window.devicePixelRatio || 1);
    const h = 195 * dpr;
    const max_w = 260 * dpr;
    const queryString = `?q=44&fit=crop&crop=top,faces&h=${h}&max-w=${max_w}`;

    if(file.thumbnail && file.thumbnail.length > 0) {
        return file.thumbnail + queryString;
    } else {
        return 'images/placeholder.png';
    }
}

function replaceThumbnailWithPlaceholder(event) {
    event.target.src = '/images/placeholder.png';

    // We also need to replace the video poster if the thumbnail is broken
    if(event.target.parentElement.dataset.type === 'customVideo') {
        event.target.parentElement.querySelector('video').poster = '/images/placeholder.png';
    }
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

        const descendingIndex = Number.MAX_SAFE_INTEGER - Date.now();
        let targetFilename = `${descendingIndex}-${files[i].name}`;

        let { 
            upload,
            controller 
        } = queueFileUpload(files[i], `original/${targetFilename}`);

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

        // Also upload a thumbnail image for videos
        if(files[i].type.split('/')[0] === 'video') {
            captureVideoThumbnail(files[i]).then((blob) => {
                queueFileUpload(blob, `video_thumbnails/${targetFilename}`);
            }).catch(error => {
                console.warn('Video thumbnail creation failed.', error);
                return false;
            });
        }
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

function queueFileUpload(file, targetFilename) {
    targetFilename = encodeURIComponent(targetFilename);
    
    let controller = new AbortController();

    let upload = fetch(`/api/photos?targetFilename=${targetFilename}`, {
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
            throw new Error(`Upload of file ${targetFilename} to blob storage failed`);
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
    toastElement.querySelector('.message').innerHTML = message;

    toastElement.classList.add('active');

    setTimeout(() => {
        toastElement.classList.remove('active');
    }, 3000);
}

function getLightboxUrl(file) {
    let { url, contentType } = file;
    if(contentType.split('/')[0] === 'image') {
        url += '?q=65&h=1080';
    }
    return url
}

function refreshLightbox() {
    if(window.refreshFsLightbox) {
        refreshFsLightbox();
        fsLightbox.props.loadOnlyCurrentSource = true;
        fsLightbox.props.onSlideChange = () => {
            console.log(document.querySelectorAll('video'));
        }
    }
}

function captureVideoThumbnail(file) {
    return new Promise((resolve, reject) => {

        const seekTo = 0.001;
        
        const tempVideo = document.createElement('video');
        tempVideo.setAttribute('src', URL.createObjectURL(file));
        tempVideo.load();

        // Seek to first frame on load
        tempVideo.addEventListener('loadedmetadata', () => {
            if (tempVideo.duration < seekTo) {
                reject("Video contains no frames.");
                return;
            }

            // Delay seeking or else 'seeked' event won't fire on Safari
            setTimeout(() => {
              tempVideo.currentTime = seekTo;
            }, 200);
        });

        // Extract thumbnail on seek
        tempVideo.addEventListener('seeked', () => {
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = tempVideo.videoWidth;
            tempCanvas.height = tempVideo.videoHeight;
            
            const ctx = tempCanvas.getContext("2d");
            ctx.drawImage(tempVideo, 0, 0, tempCanvas.width, tempCanvas.height);
            
            ctx.canvas.toBlob(
                blob => resolve(blob),
                "image/jpeg",
                0.6 // Quality
            );
        });
    });
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

if(uploadBtnElement) {
    uploadBtnElement.addEventListener('click', (event) => {
        event.preventDefault();
        imageFilesElement.click();
    });
}

if(imageFilesElement) {
    imageFilesElement.onchange = (event) => {
        uploadFiles(event);
    }
}

if(refreshLinkElement) {
    refreshLinkElement.onclick = (event) => {
        event.preventDefault();
        refreshLinkElement.classList.add('hidden');
        refreshPhotoThumbnails();
    }
}
