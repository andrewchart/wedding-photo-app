/* Functions on delete page */

// Element definitions
const manageDeleteForm = document.getElementById('manageDeleteForm');
const manageDeleteButton = document.getElementById('manageDeleteButton');
const manageDeleteGallery = document.getElementById('gallery');
const manageDeletePassword = document.getElementById('manageDeletePassword');

// Prevent submission of the password form as it interacts using fetch
manageDeleteForm.addEventListener('submit', (event) => {
    event.preventDefault();
});

// Attempt to execute deletes on button click
manageDeleteButton.addEventListener('click', (event) => {
    let files = getSelectedFiles();
    if(files.length === 0) return toastMessage('No files selected.');

    manageDeleteButton.disabled = true;
    manageDeleteButton.innerText = "Please wait...";

    deleteFiles(files, managePassword.value).then((response) => {

        return response.json().then((body) => {
            if(response.status === 401) {
                return toastMessage(`
                    ❌ ${body.outcomes.failed.length} files 
                     were not deleted. Incorrect password.
                `);
            }

            toastMessage(processDeleteOutcomes(body.outcomes));

            if(body.outcomes.completed.length > 0) { // something suceeded...
                setTimeout(() => {
                    refreshPhotoThumbnails();
                    updateManageActionButtonText();
                }, 4000);
                
                if("PasswordCredential" in window) {
                    const creds = new PasswordCredential(manageDeleteForm);
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
});

// API call to delete multiple files
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

// Toast message for delete operations
function processDeleteOutcomes(outcomes) {
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
