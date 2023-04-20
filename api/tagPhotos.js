require('dotenv').config();

// GET
async function tagPhotos(req, res) {

    try {
        res.status(200).send({
            'tag': 'tag'
        });
    } catch(error) {
        res.status(500).send({
            message: 'Internal Server Error',
            details: 'Could not tag photos.'
        });
    }
}
  
module.exports = { 
    tagPhotos
}