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

    let files = ['blah', 'blah'];

    deleteFiles(files, managePassword.value).then((response) => {

        return response.json().then((body) => {
            if(response.status === 200) {
                toastMessage(`✅ ${files.length} files successfully deleted!`)
                const creds = new PasswordCredential(managePhotosForm);
                return navigator.credentials.store(creds);
            } else {
                toastMessage(processOutcomes(body.outcomes));
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
        message += `✅ ${outcomes.completed.length} files successfully deleted. `;
    }

    if(outcomes.failed.length > 0) {
        message += `❌ The following 
            ${outcomes.failed.length} files 
            were not deleted: `;

        for(let i = outcomes.failed.length - 1; i >= 0; i--) {
            message += `'${outcomes.failed[i]}'`;
            if(i > 0) message += ", ";
        }
    }

    return message;
}

manageGallery.addEventListener('click', (event) => {
    if(event.target.id === 'gallery') return;
    event.target.closest('li').classList.toggle('selected');
    event.stopPropagation();
    event.preventDefault();
});
