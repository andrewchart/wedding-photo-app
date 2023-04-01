const managePhotosForm = document.getElementById('managePhotosForm');
const managePassword = document.getElementById('managePassword');
const manageDeleteButton = document.getElementById('manageDeleteButton');
const manageGallery = document.getElementById('gallery');

function deleteFiles(files = [], password) {
    return fetch(`/api/photos`, {
        method: 'DELETE',
        body: JSON.stringify({
            files: files,
            password: password
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    })
}

managePhotosForm.addEventListener('submit', (event) => {
    event.preventDefault();

    let files = getSelectedFiles();
    if(files.length === 0) return toastMessage('No files selected.');

    deleteFiles(files, managePassword.value).then((response) => {

        return response.json().then((body) => {
            if(response.status === 401) {
                return toastMessage(`
                    ❌ ${body.outcomes.failed.length} files 
                     were not deleted. Incorrect password.
                `);
            }

            toastMessage(processOutcomes(body.outcomes));

            if(body.outcomes.completed > 0) { // something suceeded...
                refreshPhotoThumbnails();
                updateDeleteButton();
                const creds = new PasswordCredential(managePhotosForm);
                return navigator.credentials.store(creds);
            }
        });
        
    }).catch((error) => {
        toastMessage(error.message);
    });
});

managePassword.addEventListener('input', () => {
    manageDeleteButton.disabled = (managePassword.value.length > 0) ?
        false : true;
});

function processOutcomes(outcomes) {
    let message = '';
    
    if(outcomes.completed.length > 0) {
        message += `✅ ${outcomes.completed.length} files successfully deleted.<br />`;
    }

    if(outcomes.failed.length > 0) {
        message += `
            ❌ ${outcomes.failed.length} files 
            were not deleted:`;

        for(let i = outcomes.failed.length - 1; i >= 0; i--) {
            message += `<pre>${outcomes.failed[i]}</pre>`;
        }
    }

    return message;
}

manageGallery.addEventListener('click', (event) => {
    if(event.target.id === 'gallery') return;
    event.target.closest('li').classList.toggle('selected');
    updateDeleteButton();
    event.stopPropagation();
    event.preventDefault();
});

function getSelectedFiles() { 
    const selectedElements = document.querySelectorAll('#gallery li.selected');
    let selectedFiles = [];

    selectedElements.forEach((element) => {
        selectedFiles.push(element.dataset.bucketPath);
    });

    return selectedFiles;
}

function updateDeleteButton() {
    let numSelected = getSelectedFiles().length;
    let message = 'Delete selected';
    if(numSelected > 0) message += ` (${numSelected})`;
    manageDeleteButton.innerText = message;
}
