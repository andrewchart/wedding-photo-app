
/* Setup Express */
const express = require('express');
const compression = require('compression');
const app = express();
app.use(compression());
app.use(express.json());
const port = process.env.PORT || 3000;


/* Load API Methods */
const photosAPI = require('./api/photos.js');
const downloadPhotosAPI = require('./api/downloadPhotos.js');

/* Serve static files from the public folder */
app.use(express.static('public', { index: false }));

// Route homepage to upload or download as per env setting
app.get('/', (req, res) => {
    switch(process.env.WPA_INDEX_REDIRECT) {
        case 'upload':
            res.redirect('/upload');
            break;

        case 'download':
            res.redirect('/download');
            break;

        case 'view':
            res.redirect('/view');
            break;

        default:
            res.sendFile(__dirname + '/public/index.html');
            break;
    }
});

app.get('/upload/', (req, res) => {
    if(parseInt(process.env.WPA_ENABLE_UPLOAD) !== 1) {
        return res.status(404).json({ 
            status: 404, 
            message: 'Not Found', 
            details: 'Page not found.' 
        });
    } 
    res.sendFile(__dirname + '/src/pages/upload.html');
});

app.get('/download/', (req, res) => {
    if(parseInt(process.env.WPA_ENABLE_DOWNLOAD) !== 1) {
        return res.status(404).json({ 
            status: 404, 
            message: 'Not Found', 
            details: 'Page not found.' 
        });
    } 
    res.sendFile(__dirname + '/src/pages/download.html');
});

app.get('/view/', (req, res) => {
    res.sendFile(__dirname + '/src/pages/view.html');
});

app.get('/manage/', (req, res) => {
    res.sendFile(__dirname + '/src/pages/manage.html');
});

app.get('/people/', (req, res) => {
    res.sendFile(__dirname + '/src/pages/people.html');
});

app.get('/tag/', (req, res) => {
    res.sendFile(__dirname + '/src/pages/tag.html');
});

app.get('/delete/', (req, res) => {
    res.sendFile(__dirname + '/src/pages/delete.html');
});

app.post('/delete/', (req, res) => {
    res.sendFile(__dirname + '/src/pages/delete.html');
});


/* API health check */
app.get('/api', (req, res) => {

    let response = {
        status: 200,
        message: 'OK',
        details: 'API available'
    };
  
    res.status(response.status).json(response);

});


/* Photo API endpoints */
app.get('/api/photos', (req, res) => {
    photosAPI.getPhotos(req, res);
});

app.post('/api/photos', (req, res) => {
    if(parseInt(process.env.WPA_ENABLE_UPLOAD) !== 1) {
        return res.status(405).json({ 
            status: 405, 
            message: 'Not Allowed', 
            details: 'Method not allowed.' 
        });
    } 

    photosAPI.createPhotos(req, res);
});

app.patch('/api/photos', (req, res) => {
    if(parseInt(process.env.WPA_ENABLE_UPLOAD) !== 1) {
        return res.status(405).json({ 
            status: 405, 
            message: 'Not Allowed', 
            details: 'Method not allowed.' 
        });
    } 

    photosAPI.patchPhotos(req, res);
});

app.delete('/api/photos', (req, res) => {
    photosAPI.deletePhotos(req, res);
});

app.post('/api/photos/download', (req, res) => {
    downloadPhotosAPI.downloadPhotos(req, res);
});


/* All other routes should 404 */
app.all('*', (req, res) => {
    res.status(404).json({ status: 404, message: 'Not Found', details: 'Page not found.' });
});

/* Start server */
app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});