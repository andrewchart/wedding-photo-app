require('dotenv').config();

// GET
async function downloadPhotos(req, res) {

    try {
        res.status(200).send({
            'download': 'download'
        });
    } catch(error) {
        res.status(500).send({
            message: 'Internal Server Error',
            details: 'Could not download photos.'
        });
    }
}
  
module.exports = { 
    downloadPhotos
}