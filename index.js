
/* Setup Express */
const express = require('express');
const compression = require('compression');
const app = express();
app.use(compression());
app.use(express.json());
const port = process.env.PORT || 3000;


/* Load API Methods */
const photosAPI = require('./api/photos.js');
const tagPhotosAPI = require('./api/tagPhotos.js');
const downloadPhotosAPI = require('./api/downloadPhotos.js');

/* Serve static files from the public folder */
app.use(express.static('public'));

app.get('/manage/', (req, res) => {
    res.sendFile(__dirname + '/public/manage.html');
});

app.post('/manage/', (req, res) => {
    res.sendFile(__dirname + '/public/manage.html');
});

app.get('/tag/', (req, res) => {
    res.sendFile(__dirname + '/public/tag.html');
});

app.get('/download/', (req, res) => {
    res.sendFile(__dirname + '/public/download.html');
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
    photosAPI.createPhotos(req, res);
});

app.delete('/api/photos', (req, res) => {
    photosAPI.deletePhotos(req, res);
});

app.post('/api/photos/tag', (req, res) => {
    tagPhotosAPI.tagPhotos(req, res);
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