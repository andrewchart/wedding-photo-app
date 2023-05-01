/* Shared functions on management pages */

// Element definitions
const managePassword = document.querySelector('.managePassword');
const manageActionButton = document.querySelector('.manageActionButton');
const manageGallery = document.getElementById('gallery');

// Allow selection of items
if(manageGallery) {
    manageGallery.addEventListener('click', (event) => {
        if(event.target.id === 'gallery') return;
        event.target.closest('li').classList.toggle('selected');
        updateManageActionButtonText();
        event.stopPropagation();
        event.preventDefault();
    });
}

// Returns array of selected items on manage pages
function getSelectedFiles() { 
    const selectedElements = document.querySelectorAll('#gallery li.selected');
    let selectedFiles = [];

    selectedElements.forEach((element) => {
        selectedFiles.push({ 
            "name": element.dataset.bucketPath,
            "metadata": {
                metaTags: JSON.stringify(element.metaTags),
                peopleTags: JSON.stringify(element.peopleTags)
            }
        });
    });

    return selectedFiles;
}

// Updates the text of the button according to number of items selected
function updateManageActionButtonText() {
    let numSelected = getSelectedFiles().length;
    let message = manageActionButton.dataset.callToAction;
    if(numSelected > 0 && manageActionButton.id !== 'manageTagSaveButton') {
        message += ` (${numSelected})`;
    }
    manageActionButton.innerText = message;
}

// If the action requires a password disable the button until something is entered in the pwd field
managePassword.addEventListener('input', setManageActionButtonState);

function setManageActionButtonState() {
    if(manageActionButton.classList.contains('requiresPassword')) {
       return manageActionButton.disabled = (managePassword.value.length > 0) ? false : true;
    }
    manageActionButton.disabled = false;
}

// Toast message for API operations
function processOutcomes(outcomes, verb = 'actioned') {
    let message = '';
    
    if(outcomes.completed.length > 0) {
        message += `✅ ${outcomes.completed.length} files successfully ${verb}.<br />`;
    }

    if(outcomes.failed.length > 0) {
        message += `
            ❌ ${outcomes.failed.length} files 
            were not ${verb}:`;

        for(let i = outcomes.failed.length - 1; i >= 0; i--) {
            message += `<pre>${outcomes.failed[i].name}</pre>`;
        }
    }

    return message;
}
