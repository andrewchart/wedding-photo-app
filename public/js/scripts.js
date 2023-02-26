

function renderPhotoThumbnails(pageSize = 12) {

    let galleryElement = document.getElementById('gallery');
    let spinnerElement = document.getElementById('spinner');
    let galleryItemTemplate = document.getElementById('gallery-item').content;
    let pageMarker = galleryElement.dataset.nextPage || "";
    
    if(galleryElement.dataset.done === "true") return;

    // Start spinner
    spinnerElement.classList.remove('hidden');

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
                return;
            };

        })

        .catch(() => {

            setRefreshMessages(
                "Sorry, an error has occured.",
                "Tap here to try again"
            );

            galleryElement.dataset.done = "true";

            showRefreshLink();

        })

        .finally(() => {
            spinnerElement.classList.add('hidden');
        });

};

function loadMoreOnScroll() {

    throttle(() => {

        if(window.innerHeight + window.pageYOffset >= document.body.offsetHeight) {
            console.log('load more');
            renderPhotoThumbnails(2);
        };

    }, 1000);
    
}

function refreshPhotoThumbnails() {

}

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


// Scroll event throttling
var throttleTimer;

function throttle(callback, time) {
    if(throttleTimer) return;
    
    throttleTimer = setTimeout(() => {
        callback();
        throttleTimer = false;
    }, time);
};