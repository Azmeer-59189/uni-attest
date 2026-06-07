const express = require('express');
const verifyController = require('../controllers/verify');

const router = express.Router();

router.get('/:hash', verifyController.verifyByHash);

module.exports = router;