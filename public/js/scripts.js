

function renderPhotoThumbnails(pageSize = 12) {

    let galleryElement = document.getElementById('gallery');
    let spinnerElement = document.getElementById('spinner');
    let galleryItemTemplate = document.getElementById('gallery-item').content;
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
            data.urls.forEach(url => {
                let galleryItem = galleryItemTemplate.cloneNode(true);

                galleryItem.querySelector('a').href = url;
                galleryItem.querySelector('img').src = getThumbnailUrl(url);
                
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

/* Event handlers */
document.addEventListener('DOMContentLoaded', renderPhotoThumbnails(2));
document.addEventListener('scroll', loadMoreOnScroll);

document.getElementById('uploadBtn').onclick = () => {
    document.getElementById('imageFiles').click();
}

document.getElementById('imageFiles').onchange = (event) => {
    console.log('files changed', event.target.files);
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