
// Setup Express
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

/* Serve static files from the public folder */
app.use(express.static('public'));

/* API health check */
app.get('/api', (req, res) => {

    let response = {
        status: 200,
        message: 'OK',
        details: 'API available'
    };
  
    res.status(response.status).json(response);

});

/* All other routes should 404 */
app.all('*', (req, res) => {
    res.status(404).json({ status: 404, message: 'Not Found', details: 'Page not found.' });
});

/* Start server */
app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});