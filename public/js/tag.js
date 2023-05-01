/* Functions on tag page */

// Element definitions
const manageTagSaveButton = document.getElementById('manageTagSaveButton');
const manageTagForm = document.getElementById('manageTagForm');

// Prevent submission of the password form as it interacts using fetch
manageTagForm.addEventListener('submit', (event) => {
    event.preventDefault();
});

// Attempt to execute patches on button click
manageTagSaveButton.addEventListener('click', saveTags);

// Renders tag elements on file <li> elements
function renderTags(targetElement = null) {
    let metaTagLists, peopleTagLists;

    if(targetElement) {
        metaTagLists = targetElement.querySelectorAll('ul.metaTags');
        peopleTagLists = targetElement.querySelectorAll('ul.peopleTags');
    } else {
        metaTagLists = document.querySelectorAll('ul.metaTags');
        peopleTagLists = document.querySelectorAll('ul.peopleTags');
    }

    metaTagLists.forEach((list) => {
        list.innerHTML = '';
        const tagsToRender = (list.closest('ul#gallery > li').metaTags || []);
        tagsToRender.forEach((tag) => {
            list.innerHTML += `<li>${tag.name}<a class="deleteTag"></a></li>`;
        });
    });

    peopleTagLists.forEach((list) => {
        list.innerHTML = '';
        const tagsToRender = (list.closest('ul#gallery > li').peopleTags || []);
        tagsToRender.forEach((tag) => {
            list.innerHTML += `<li>${tag.name}<a class="deleteTag"></a></li>`;
        });
    });
}

// Event handler for click on remove single tag button
galleryElement.addEventListener('click', (event) => {
    if(event.target.classList.contains('deleteTag')) {
        const fileLi = event.target.closest('ul').closest('li'); // AKA tag list <ul>'s parent <li>
        const tagType = event.target.closest('ul').classList[0];
        const tagName = event.target.closest('li').innerText;

        removeTag(fileLi, tagType, tagName);
        renderTags(fileLi);
    }
});

// Add tag to an <li> for a given file
function addTag(element, tagType, tagName) {
    if(!element || !tagType || !tagName) return false;

    element[tagType] = element[tagType] || [];

    // Remove the tag from the array
    element[tagType].push({ "name": tagName });

    // Mark the <li> as having had its tags modified
    element.dataset.tagsChanged = true;
    return true;
}

// Remove tag from <li> for a given file
function removeTag(element, tagType, tagName) {
    if(!element || !tagType || !tagName) return false;

    // Remove the tag from the array
    element[tagType].splice(
        element[tagType].findIndex(tag => tag.name === tagName), 
        1
    );

    // Mark the <li> as having had its tags modified
    element.dataset.tagsChanged = true;
    return true;
}

// Persists changes to tags via the API
function saveTags() {
    let files = getChangedTagFiles();
    if(files.length === 0) return toastMessage('No files have had their tags changed.');
    
    patchFiles(files, managePassword.value).then((response) => {

        return response.json().then((body) => {
            if(response.status === 401) {
                return toastMessage(`
                    ❌ ${body.outcomes.failed.length} files 
                        were not modified. Incorrect password.
                `);
            }

            toastMessage(processOutcomes(body.outcomes, "updated"));

            if(body.outcomes.completed.length > 0) { // something suceeded...
                setTimeout(() => {
                    //refreshPhotoThumbnails(); // TODO: reset modified states but nothing else?
                    updateManageActionButtonText();
                }, 4000);
                
                if("PasswordCredential" in window) {
                    const creds = new PasswordCredential(manageTagForm);
                    return navigator.credentials.store(creds);
                }
            }
        });
        
    }).catch((error) => {
        toastMessage(error.message);
    }).finally(() => {
        updateManageActionButtonText();
        setManageActionButtonState();
    });
}

// Returns all the <li> elements that have had their tags modified
function getChangedTagFiles() {
    const changedElements = document.querySelectorAll('#gallery li[data-tags-changed="true"]');
    let changedFiles = [];

    changedElements.forEach((element) => {
        changedFiles.push({ 
            "name": element.dataset.bucketPath,
            "metadata": {
                metaTags: JSON.stringify(element.metaTags),
                peopleTags: JSON.stringify(element.peopleTags)
            }
        });
    });

    return changedFiles;
}

// API call to patch multiple files
function patchFiles(files = [], password) {
    return fetch(`/api/photos`, {
        method: 'PATCH',
        body: JSON.stringify({
            files: files,
            password: password
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    });
}
